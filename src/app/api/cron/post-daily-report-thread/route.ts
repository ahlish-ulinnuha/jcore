import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendSlackMessage } from "@/lib/slack";

export const dynamic = "force-dynamic";

const THREAD_TYPE = "daily_report";

function tomorrowJakarta() {
  const todayLabel = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Jakarta",
    year: "numeric",
  }).format(new Date());
  const todayUtc = new Date(`${todayLabel}T00:00:00Z`);
  todayUtc.setUTCDate(todayUtc.getUTCDate() + 1);
  return todayUtc.toISOString().slice(0, 10);
}

function displayDate(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}-${month}-${year}`;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const channel = process.env.DAILY_REPORT_CHANNEL_ID;
  if (!channel) {
    return NextResponse.json({ error: "DAILY_REPORT_CHANNEL_ID belum diisi di environment.", ok: false }, { status: 500 });
  }

  const supabase = createServiceClient();
  const date = tomorrowJakarta();
  const dateLabel = displayDate(date);

  const { data: existing } = await supabase
    .from("slack_daily_threads")
    .select("thread_ts")
    .eq("channel_id", channel)
    .eq("thread_date", date)
    .eq("thread_type", THREAD_TYPE)
    .maybeSingle();

  if (existing?.thread_ts) {
    return NextResponse.json({ dateLabel, ok: true, skipped: true, threadTs: existing.thread_ts });
  }

  const result = await sendSlackMessage(`Daily Report ${dateLabel}`, channel);
  if (!result.ok) {
    return NextResponse.json({ error: result.error, ok: false }, { status: 500 });
  }

  const { error: insertError } = await supabase.from("slack_daily_threads").insert({
    channel_id: channel,
    thread_date: date,
    thread_type: THREAD_TYPE,
    thread_ts: result.ts,
  });

  if (insertError) {
    return NextResponse.json({ dateLabel, error: insertError.message, ok: false, stage: "insert_thread", threadTs: result.ts }, { status: 500 });
  }

  return NextResponse.json({ dateLabel, ok: true, threadTs: result.ts });
}
