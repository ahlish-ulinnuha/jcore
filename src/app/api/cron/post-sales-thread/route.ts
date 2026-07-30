import { NextResponse } from "next/server";
import { sendSlackMessage } from "@/lib/slack";

export const dynamic = "force-dynamic";

function todayJakarta() {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Jakarta",
    year: "numeric",
  }).format(new Date());
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

  const channel = process.env.SALES_REPORT_CHANNEL_ID;
  if (!channel) {
    return NextResponse.json({ error: "SALES_REPORT_CHANNEL_ID belum diisi di environment.", ok: false }, { status: 500 });
  }

  const dateLabel = displayDate(todayJakarta());
  const result = await sendSlackMessage(`Sales ${dateLabel}`, channel);

  if (!result.ok) {
    return NextResponse.json({ error: result.error, ok: false }, { status: 500 });
  }

  return NextResponse.json({ dateLabel, ok: true });
}
