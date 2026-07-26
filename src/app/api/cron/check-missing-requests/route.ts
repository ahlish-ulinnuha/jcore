import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendSlackMessage } from "@/lib/slack";
import type { Store } from "@/lib/types";

export const dynamic = "force-dynamic";

function todayJakarta() {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Jakarta",
    year: "numeric",
  }).format(new Date());
}

function tomorrow(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  utcDate.setUTCDate(utcDate.getUTCDate() + 1);
  return utcDate.toISOString().slice(0, 10);
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

  const supabase = createServiceClient();
  const targetDate = tomorrow(todayJakarta());
  const dateLabel = displayDate(targetDate);

  const { data: stores, error: storesError } = await supabase.from("stores").select("*").eq("is_active", true).returns<Store[]>();
  if (storesError) {
    return NextResponse.json({ error: storesError.message, stage: "query_stores" }, { status: 500 });
  }

  const { data: submittedRequests, error: requestsError } = await supabase
    .from("purchase_requests")
    .select("store_id")
    .eq("request_date", targetDate)
    .eq("status", "submitted");
  if (requestsError) {
    return NextResponse.json({ error: requestsError.message, stage: "query_requests" }, { status: 500 });
  }

  const submittedStoreIds = new Set((submittedRequests ?? []).map((row) => row.store_id));
  const missingStores = (stores ?? []).filter((store) => !submittedStoreIds.has(store.id));

  if (missingStores.length === 0) {
    return NextResponse.json({ dateLabel, missingStores: [], ok: true });
  }

  const missingStoreIds = missingStores.map((store) => store.id);
  const { data: staffRows, error: staffError } = await supabase
    .from("profiles")
    .select("full_name, slack_member_id, store_id")
    .eq("role", "staff")
    .in("store_id", missingStoreIds);

  if (staffError) {
    return NextResponse.json({ error: staffError.message, stage: "query_staff" }, { status: 500 });
  }

  const staffByStoreId = new Map<string, { full_name: string; slack_member_id: string | null }[]>();
  for (const staff of staffRows ?? []) {
    if (!staff.store_id) continue;
    const list = staffByStoreId.get(staff.store_id) ?? [];
    list.push({ full_name: staff.full_name, slack_member_id: staff.slack_member_id });
    staffByStoreId.set(staff.store_id, list);
  }

  const channel = process.env.DAILY_REPORT_CHANNEL_ID;
  const lines = missingStores.map((store) => {
    const staff = staffByStoreId.get(store.id) ?? [];
    const mentions = staff.map((member) => (member.slack_member_id ? `<@${member.slack_member_id}>` : member.full_name)).join(" ");
    return mentions ? `- ${store.name}: ${mentions}` : `- ${store.name}`;
  });
  const message = [`*Belum ada request untuk ${dateLabel}*`, "Store berikut belum submit purchase request:", ...lines].join("\n");

  const result = await sendSlackMessage(message, channel);
  if (!result.ok) {
    return NextResponse.json({ error: result.error, missingStores: missingStores.map((store) => store.name), ok: false }, { status: 500 });
  }

  return NextResponse.json({ dateLabel, missingStores: missingStores.map((store) => store.name), ok: true });
}
