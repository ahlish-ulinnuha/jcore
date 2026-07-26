import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { formatSlackMention, sendSlackMessage } from "@/lib/slack";

export const dynamic = "force-dynamic";

const OFF_SHIFT_CODES = new Set(["OFF", "OL"]);

type OpenAttendanceRow = {
  staff_id: string;
  check_in_at: string;
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

function checkInDateJakarta(checkInAt: string) {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Jakarta",
    year: "numeric",
  }).format(new Date(checkInAt));
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const date = todayJakarta();

  // Any still-open session counts, regardless of which day check-in happened -
  // scoping to "today" would miss anyone who checked in before midnight WIB and
  // still hasn't checked out.
  const { data: openAttendance, error: attendanceError } = await supabase
    .from("staff_attendance")
    .select("staff_id, check_in_at, profiles(full_name, slack_member_id)")
    .is("check_out_at", null)
    .returns<OpenAttendanceRow[]>();

  if (attendanceError) {
    return NextResponse.json({ error: attendanceError.message, stage: "query_attendance" }, { status: 500 });
  }

  const rows = openAttendance ?? [];
  const debug = {
    openSessions: rows.map((row) => ({
      checkInAt: row.check_in_at,
      checkInDate: checkInDateJakarta(row.check_in_at),
      fullName: row.profiles?.full_name ?? null,
      staffId: row.staff_id,
    })),
  };

  if (rows.length === 0) {
    return NextResponse.json({ date, debug, missingCheckout: [], ok: true });
  }

  const staffIds = Array.from(new Set(rows.map((row) => row.staff_id)));
  const checkInDates = Array.from(new Set(rows.map((row) => checkInDateJakarta(row.check_in_at))));
  const { data: schedules, error: scheduleError } = await supabase
    .from("store_staff_schedules")
    .select("staff_id, work_date, shift_code")
    .in("staff_id", staffIds)
    .in("work_date", checkInDates);

  if (scheduleError) {
    return NextResponse.json({ error: scheduleError.message, stage: "query_schedules" }, { status: 500 });
  }

  Object.assign(debug, { schedules: schedules ?? [] });

  const offKeys = new Set(
    (schedules ?? [])
      .filter((schedule) => schedule.shift_code && OFF_SHIFT_CODES.has(schedule.shift_code))
      .map((schedule) => `${schedule.staff_id}:${schedule.work_date}`),
  );

  const stillOpen = rows.filter((row) => !offKeys.has(`${row.staff_id}:${checkInDateJakarta(row.check_in_at)}`));
  if (stillOpen.length === 0) {
    return NextResponse.json({ date, debug, missingCheckout: [], ok: true });
  }

  const lines = stillOpen.map((row) => {
    const mention = formatSlackMention(row.profiles?.slack_member_id, row.profiles?.full_name ?? "Unknown");
    return `- ${mention} (checkin ${checkInDateJakarta(row.check_in_at)})`;
  });

  const message = [`*Belum Checkout - ${date}*`, "Staff berikut belum checkout:", ...lines].join("\n");
  const result = await sendSlackMessage(message);

  if (!result.ok) {
    return NextResponse.json({ debug, error: result.error, missingCheckout: stillOpen.map((row) => row.staff_id), ok: false }, { status: 500 });
  }

  return NextResponse.json({ date, debug, missingCheckout: stillOpen.map((row) => row.staff_id), ok: true });
}
