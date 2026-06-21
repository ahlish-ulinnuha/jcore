"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Store } from "@/lib/types";

const denominations = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100] as const;

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function numberValue(formData: FormData, key: string) {
  const value = Number(text(formData, key));
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

  const cashCounts = Object.fromEntries(denominations.map((denomination) => [`cash_${denomination}`, countValue(formData, denomination)]));
  const cashTotal = denominations.reduce((total, denomination) => total + countValue(formData, denomination) * denomination, 0);
  const systemNominal = numberValue(formData, "system_nominal");
  const qris = numberValue(formData, "qris");
  const debit = numberValue(formData, "debit");
  const shopee = numberValue(formData, "shopee");
  const expense = numberValue(formData, "expense");
  const difference = cashTotal + qris + debit + shopee + expense - systemNominal;

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
    expense,
    expense_detail: text(formData, "expense_detail") || null,
    difference,
    notes: text(formData, "notes") || null,
    updated_by: user.id,
  };

  const { data: existing } = await supabase
    .from("daily_sales_reports")
    .select("id")
    .eq("report_date", reportDate)
    .eq("store_id", store.id)
    .maybeSingle();

  if (existing?.id) {
    await supabase.from("daily_sales_reports").update(payload).eq("id", existing.id);
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
