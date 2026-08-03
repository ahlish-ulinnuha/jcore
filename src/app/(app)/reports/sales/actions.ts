"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sendSlackMessage } from "@/lib/slack";
import { createClient } from "@/lib/supabase/server";
import type { DailySalesReport, Profile, Store } from "@/lib/types";

export type SendSalesSlackResult = { ok: true } | { ok: false; error: string };

const denominations = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100] as const;

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function numberValue(formData: FormData, key: string) {
  const value = Number(text(formData, key).replace(/\./g, ""));
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function countValue(formData: FormData, denomination: number) {
  return Math.floor(numberValue(formData, `cash_${denomination}`));
}

export async function saveDailySalesReport(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*, stores(*)").eq("id", user.id).single<Profile>();
  if (!profile || profile.role === "vendor") redirect("/dashboard");

  const reportDate = text(formData, "report_date");
  const selectedStoreId = profile.role === "admin" ? text(formData, "store_id") : profile.store_id ?? "";
  if (!reportDate || !selectedStoreId) redirect("/reports/sales?error=missing-store");

  const { data: store } = await supabase.from("stores").select("*").eq("id", selectedStoreId).single<Store>();
  if (!store) redirect("/reports/sales?error=missing-store");

  const { data: existingReport } = await supabase
    .from("daily_sales_reports")
    .select("id, attachment_url, attachment_name")
    .eq("report_date", reportDate)
    .eq("store_id", store.id)
    .maybeSingle<Pick<DailySalesReport, "id" | "attachment_url" | "attachment_name">>();

  let attachmentUrl = existingReport?.attachment_url ?? null;
  let attachmentName = existingReport?.attachment_name ?? null;
  const attachmentFile = formData.get("attachment");
  if (attachmentFile instanceof File && attachmentFile.size > 0) {
    const safeFileName = attachmentFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${store.id}/${reportDate}-${Date.now()}-${safeFileName}`;
    const { error: uploadError } = await supabase.storage.from("sales-report-attachments").upload(path, attachmentFile, {
      contentType: attachmentFile.type || undefined,
      upsert: true,
    });
    if (!uploadError) {
      const { data: publicUrl } = supabase.storage.from("sales-report-attachments").getPublicUrl(path);
      attachmentUrl = publicUrl.publicUrl;
      attachmentName = attachmentFile.name;
    }
  }

  const cashCounts = Object.fromEntries(denominations.map((denomination) => [`cash_${denomination}`, countValue(formData, denomination)]));
  const cashTotal = denominations.reduce((total, denomination) => total + countValue(formData, denomination) * denomination, 0);
  const systemNominal = numberValue(formData, "system_nominal");
  const qris = numberValue(formData, "qris");
  const debit = numberValue(formData, "debit");
  const shopee = numberValue(formData, "shopee");
  const grab = numberValue(formData, "grab");
  const gojek = numberValue(formData, "gojek");
  const expense = numberValue(formData, "expense");
  const difference = cashTotal + qris + debit + shopee + grab + gojek + expense - systemNominal;

  const payload = {
    report_date: reportDate,
    store_id: store.id,
    store_name: store.name,
    system_nominal: systemNominal,
    cash_total: cashTotal,
    ...cashCounts,
    qris,
    debit,
    shopee,
    grab,
    gojek,
    expense,
    expense_detail: text(formData, "expense_detail") || null,
    difference,
    notes: text(formData, "notes") || null,
    attachment_url: attachmentUrl,
    attachment_name: attachmentName,
    updated_by: user.id,
  };

  if (existingReport?.id) {
    await supabase.from("daily_sales_reports").update(payload).eq("id", existingReport.id);
  } else {
    await supabase.from("daily_sales_reports").insert({ ...payload, created_by: user.id });
  }

  revalidatePath("/reports/sales");
  redirect(`/reports/sales?date=${reportDate}&store=${store.id}&saved=1`);
}

export async function deleteDailySalesReport(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile || profile.role !== "admin") redirect("/dashboard");

  const id = text(formData, "id");
  const redirectTo = text(formData, "redirect_to") || "/reports/sales";
  if (id) {
    await supabase.from("daily_sales_reports").delete().eq("id", id);
  }

  revalidatePath("/reports/sales");
  redirect(`${redirectTo}${redirectTo.includes("?") ? "&" : "?"}deleted=1`);
}

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    currency: "IDR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

export async function sendSalesSummaryToSlack(formData: FormData): Promise<SendSalesSlackResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Anda belum login.", ok: false };

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile || profile.role === "vendor") return { error: "Tidak diizinkan.", ok: false };

  const reportId = text(formData, "report_id");
  if (!reportId) return { error: "Simpan report sales terlebih dahulu.", ok: false };

  const { data: report } = await supabase
    .from("daily_sales_reports")
    .select("*")
    .eq("id", reportId)
    .single<DailySalesReport>();
  if (!report) return { error: "Report sales tidak ditemukan.", ok: false };

  const [year, month, day] = report.report_date.split("-");
  const dateLabel = `${day}-${month}-${year}`;

  const lines = [
    `*_📊 Sales Report ${dateLabel}_*`,
    `Store: ${report.store_name}`,
    `Nominal System: ${formatRupiah(Number(report.system_nominal))}`,
    `Tunai: ${formatRupiah(Number(report.cash_total))}`,
    `Qris: ${formatRupiah(Number(report.qris))}`,
    `Debit: ${formatRupiah(Number(report.debit))}`,
    `Shopee: ${formatRupiah(Number(report.shopee))}`,
    `Grab: ${formatRupiah(Number(report.grab ?? 0))}`,
    `Gojek: ${formatRupiah(Number(report.gojek ?? 0))}`,
    `Pengeluaran: ${formatRupiah(Number(report.expense))}`,
    `Selisih: ${formatRupiah(Number(report.difference))}`,
    ...(report.notes ? [`Catatan: ${report.notes}`] : []),
    ...(report.attachment_url ? [`Lampiran: ${report.attachment_url}`] : []),
    "------------------------------ ",
    `Dikirim oleh: ${profile.full_name}`,
  ];

  const channel = process.env.SALES_REPORT_CHANNEL_ID;

  let threadTs: string | undefined;
  if (channel) {
    const { data: thread } = await supabase
      .from("slack_daily_threads")
      .select("thread_ts")
      .eq("channel_id", channel)
      .eq("thread_date", report.report_date)
      .eq("thread_type", "sales_report")
      .maybeSingle();
    threadTs = thread?.thread_ts ?? undefined;
  }

  const result = await sendSlackMessage(lines.join("\n"), channel, threadTs);
  if (!result.ok) return { error: result.error, ok: false };

  return { ok: true };
}
