import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendWhatsappMessageTo } from "@/lib/whatsapp";
import type { DailySpiceReport, PurchaseRequestItem, Vendor } from "@/lib/types";

export const dynamic = "force-dynamic";

type ItemWithRelations = PurchaseRequestItem & {
  vendors?: Vendor | null;
  products?: { name: string; brands?: { name: string | null } | null } | null;
  purchase_requests?: { batch_no?: number; request_date?: string; status?: string } | null;
};

type VendorBatchGroup = {
  batchNo: number;
  lines: string[];
  phone: string | null;
  vendorId: string;
  vendorName: string;
};

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

function isBumbuVendor(vendorName: string) {
  return vendorName.trim().toLowerCase().includes("bumbu");
}

function sumSpiceStock(reports: DailySpiceReport[]) {
  return reports.reduce(
    (totals, report) => ({
      red: totals.red + Number(report.red_spice_stock),
      white: totals.white + Number(report.white_spice_stock),
    }),
    { red: 0, white: 0 },
  );
}

function buildMessage(
  vendorName: string,
  batchNo: number,
  dateLabel: string,
  lines: string[],
  includeSpiceSummary: boolean,
  spiceReports: DailySpiceReport[],
) {
  const parts = [`*Request ${vendorName} - Batch ${batchNo}*`, `Tanggal: ${dateLabel}`, "------------------------------", ...lines];
  if (includeSpiceSummary) {
    parts.push("------------------------------", "*Sisa Stock Bumbu*", `Tanggal: ${dateLabel}`, "");
    if (spiceReports.length > 0) {
      const totals = sumSpiceStock(spiceReports);
      parts.push(`- Merah : ${totals.red}`, `- Putih : ${totals.white}`);
    } else {
      parts.push("Belum ada laporan stock bumbu hari ini.");
    }
  }
  return parts.join("\n");
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const date = todayJakarta();
  const dateLabel = displayDate(date);
  const force = new URL(request.url).searchParams.get("force") === "true";

  const { data: items, error: itemsError } = await supabase
    .from("purchase_request_items")
    .select("*, products(*, brands(*)), vendors!inner(*), purchase_requests!inner(batch_no, request_date, status)")
    .eq("purchase_requests.request_date", date)
    .eq("purchase_requests.status", "submitted")
    .eq("vendors.auto_send_purchase", true)
    .returns<ItemWithRelations[]>();

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message, sent: 0, failed: 0, skipped: 0, stage: "query_items" }, { status: 500 });
  }

  const rows = items ?? [];
  if (rows.length === 0) {
    return NextResponse.json({ sent: 0, failed: 0, skipped: 0, date, debug: "no submitted items today with auto_send_purchase vendors" });
  }

  const groups = new Map<string, VendorBatchGroup>();
  for (const item of rows) {
    const batchNo = item.purchase_requests?.batch_no ?? 0;
    const key = `${item.vendor_id}:${batchNo}`;
    if (!groups.has(key)) {
      groups.set(key, {
        batchNo,
        lines: [],
        phone: item.vendors?.phone ?? null,
        vendorId: item.vendor_id,
        vendorName: item.vendors?.name ?? "Unknown Vendor",
      });
    }
    const brand = item.products?.brands?.name?.trim().toUpperCase();
    const brandSuffix = brand && brand !== "NOBRAND" ? ` - ${brand}` : "";
    groups.get(key)!.lines.push(`- ${item.products?.name ?? "-"}${brandSuffix} / ${item.qty} ${item.unit}`.trim());
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const debug: Record<string, unknown>[] = [];

  const needsSpiceSummary = Array.from(groups.values()).some((group) => isBumbuVendor(group.vendorName));
  let spiceReports: DailySpiceReport[] = [];
  if (needsSpiceSummary) {
    const { data, error: spiceError } = await supabase
      .from("daily_spice_reports")
      .select("*")
      .eq("report_date", date)
      .returns<DailySpiceReport[]>();
    spiceReports = data ?? [];
    if (spiceError) debug.push({ error: spiceError.message, stage: "query_daily_spice_reports" });
  }

  for (const group of groups.values()) {
    const groupDebug: Record<string, unknown> = {
      batchNo: group.batchNo,
      isBumbu: isBumbuVendor(group.vendorName),
      phone: group.phone,
      vendorName: group.vendorName,
    };

    if (!force) {
      const { data: alreadySent, error: alreadySentError } = await supabase
        .from("vendor_message_logs")
        .select("id")
        .eq("vendor_id", group.vendorId)
        .eq("request_date", date)
        .eq("batch_no", group.batchNo)
        .eq("status", "success")
        .limit(1)
        .maybeSingle();

      if (alreadySentError) groupDebug.alreadySentCheckError = alreadySentError.message;

      if (alreadySent) {
        skipped += 1;
        groupDebug.result = "skipped_already_sent";
        debug.push(groupDebug);
        continue;
      }
    }

    const message = buildMessage(
      group.vendorName,
      group.batchNo,
      dateLabel,
      group.lines,
      isBumbuVendor(group.vendorName),
      spiceReports,
    );

    if (!group.phone) {
      failed += 1;
      const { error: insertError } = await supabase.from("vendor_message_logs").insert({
        batch_no: group.batchNo,
        error_message: "Nomor WhatsApp vendor belum diisi.",
        message,
        phone: null,
        request_date: date,
        source: "cron",
        status: "failed",
        vendor_id: group.vendorId,
      });
      groupDebug.result = "failed_no_phone";
      if (insertError) groupDebug.insertError = insertError.message;
      debug.push(groupDebug);
      continue;
    }

    const normalizedPhone = normalizePhone(group.phone);
    const result = await sendWhatsappMessageTo(normalizedPhone, message);
    if (result.ok) sent += 1;
    else failed += 1;

    const { error: insertError } = await supabase.from("vendor_message_logs").insert({
      batch_no: group.batchNo,
      error_message: result.ok ? null : result.error,
      message,
      phone: normalizedPhone,
      request_date: date,
      source: "cron",
      status: result.ok ? "success" : "failed",
      vendor_id: group.vendorId,
    });

    groupDebug.result = result.ok ? "sent" : "send_failed";
    groupDebug.normalizedPhone = normalizedPhone;
    if (!result.ok) groupDebug.sendError = result.error;
    if (insertError) groupDebug.insertError = insertError.message;
    debug.push(groupDebug);
  }

  return NextResponse.json({ date, debug, failed, groupsFound: groups.size, sent, skipped });
}
