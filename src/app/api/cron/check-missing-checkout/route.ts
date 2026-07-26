import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { formatSlackMention, sendSlackMessage } from "@/lib/slack";

export const dynamic = "force-dynamic";

const OFF_SHIFT_CODES = new Set(["OFF", "OL"]);

type OpenAttendanceRow = {
  staff_id: string;
  profiles: { full_name: string; slack_member_id: string | null } | null;
};

function todayJakarta() {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Jakarta",
    year: "numeric",
  }).format(new Date());
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const date = todayJakarta();
  const dayStart = `${date}T00:00:00+07:00`;
  const dayEnd = `${date}T23:59:59+07:00`;

  const { data: openAttendance, error: attendanceError } = await supabase
    .from("staff_attendance")
    .select("staff_id, profiles(full_name, slack_member_id)")
    .is("check_out_at", null)
    .gte("check_in_at", dayStart)
    .lte("check_in_at", dayEnd)
    .returns<OpenAttendanceRow[]>();

  if (attendanceError) {
    return NextResponse.json({ error: attendanceError.message, stage: "query_attendance" }, { status: 500 });
  }

  const rows = openAttendance ?? [];
  const debug = {
    dayEnd,
    dayStart,
    openSessions: rows.map((row) => ({ fullName: row.profiles?.full_name ?? null, staffId: row.staff_id })),
  };

  if (rows.length === 0) {
    return NextResponse.json({ date, debug, missingCheckout: [], ok: true });
  }

  const staffIds = rows.map((row) => row.staff_id);
  const { data: schedules, error: scheduleError } = await supabase
    .from("store_staff_schedules")
    .select("staff_id, shift_code")
    .eq("work_date", date)
    .in("staff_id", staffIds);

  if (scheduleError) {
    return NextResponse.json({ error: scheduleError.message, stage: "query_schedules" }, { status: 500 });
  }

  Object.assign(debug, { schedules: schedules ?? [] });

  const offStaffIds = new Set(
    (schedules ?? []).filter((schedule) => schedule.shift_code && OFF_SHIFT_CODES.has(schedule.shift_code)).map((schedule) => schedule.staff_id),
  );

  const stillOpen = rows.filter((row) => !offStaffIds.has(row.staff_id));
  if (stillOpen.length === 0) {
    return NextResponse.json({ date, debug, missingCheckout: [], ok: true });
  }

  const lines = stillOpen.map((row) => {
    const mention = formatSlackMention(row.profiles?.slack_member_id, row.profiles?.full_name ?? "Unknown");
    return `- ${mention}`;
  });

  const message = [`*Belum Checkout - ${date}*`, "Staff berikut belum checkout hari ini:", ...lines].join("\n");
  const result = await sendSlackMessage(message);

  if (!result.ok) {
    return NextResponse.json({ debug, error: result.error, missingCheckout: stillOpen.map((row) => row.staff_id), ok: false }, { status: 500 });
  }

  return NextResponse.json({ date, debug, missingCheckout: stillOpen.map((row) => row.staff_id), ok: true });
}
