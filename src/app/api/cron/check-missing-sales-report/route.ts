import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendTelegramMessage } from "@/lib/telegram";
import { sendWhatsappMessageTo } from "@/lib/whatsapp";
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

function displayDate(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}-${month}-${year}`;
}

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  return digits;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const targetDate = todayJakarta();
  const dateLabel = displayDate(targetDate);

  const { data: allStores, error: storesError } = await supabase.from("stores").select("*").eq("is_active", true).returns<Store[]>();
  if (storesError) {
    return NextResponse.json({ error: storesError.message, stage: "query_stores" }, { status: 500 });
  }

  const stores = (allStores ?? []).filter((store) => store.name.trim().toLowerCase() !== "all store");

  const { data: submittedReports, error: reportsError } = await supabase
    .from("daily_sales_reports")
    .select("store_id")
    .eq("report_date", targetDate);
  if (reportsError) {
    return NextResponse.json({ error: reportsError.message, stage: "query_reports" }, { status: 500 });
  }

  const submittedStoreIds = new Set((submittedReports ?? []).map((row) => row.store_id));
  const missingStores = stores.filter((store) => !submittedStoreIds.has(store.id));

  if (missingStores.length === 0) {
    return NextResponse.json({ dateLabel, missingStores: [], ok: true });
  }

  const missingStoreIds = missingStores.map((store) => store.id);
  const { data: staffRows, error: staffError } = await supabase
    .from("profiles")
    .select("full_name, phone, store_id")
    .eq("role", "staff")
    .in("store_id", missingStoreIds);

  if (staffError) {
    return NextResponse.json({ error: staffError.message, stage: "query_staff" }, { status: 500 });
  }

  const staffByStoreId = new Map<string, { full_name: string; phone: string | null }[]>();
  for (const staff of staffRows ?? []) {
    if (!staff.store_id) continue;
    const list = staffByStoreId.get(staff.store_id) ?? [];
    list.push({ full_name: staff.full_name, phone: staff.phone });
    staffByStoreId.set(staff.store_id, list);
  }

  const results: { store: string; ok: boolean; error?: string }[] = [];

  for (const store of missingStores) {
    const staff = staffByStoreId.get(store.id) ?? [];
    const targets = staff.map((member) => member.phone).filter((phone): phone is string => Boolean(phone)).map(normalizePhone);
    if (targets.length === 0) {
      results.push({ error: "Tidak ada nomor WhatsApp staff.", ok: false, store: store.name });
      continue;
    }

    const message = [
      `Sales report untuk toko ${store.name} tanggal ${dateLabel} belum dikirim.`,
      "Mohon segera dikirim melalui menu Report Sales.",
    ].join("\n");

    const result = await sendWhatsappMessageTo(targets.join(","), message);
    results.push(result.ok ? { ok: true, store: store.name } : { error: result.error, ok: false, store: store.name });
  }

  await sendTelegramMessage(
    [
      `⚠️ Sales Report belum dikirim (${dateLabel})`,
      "Store berikut belum submit sales report:",
      ...missingStores.map((store) => `- ${store.name}`),
    ].join("\n"),
  );

  const ok = results.every((result) => result.ok);
  return NextResponse.json({ dateLabel, ok, results }, { status: ok ? 200 : 500 });
}
