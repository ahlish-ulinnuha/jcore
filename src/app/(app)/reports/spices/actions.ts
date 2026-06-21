"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Store } from "@/lib/types";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function numberValue(formData: FormData, key: string) {
  const value = Number(text(formData, key));
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

export async function saveDailySpiceReport(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*, stores(*)").eq("id", user.id).single<Profile>();
  if (!profile || profile.role === "vendor") redirect("/dashboard");

  const reportDate = text(formData, "report_date");
  const selectedStoreId = profile.role === "admin" ? text(formData, "store_id") : profile.store_id ?? "";
  if (!reportDate || !selectedStoreId) redirect("/reports/spices?error=missing-store");

  const { data: store } = await supabase.from("stores").select("*").eq("id", selectedStoreId).single<Store>();
  if (!store) redirect("/reports/spices?error=missing-store");

  const payload = {
    report_date: reportDate,
    store_id: store.id,
    store_name: store.name,
    red_spice_stock: numberValue(formData, "red_spice_stock"),
    white_spice_stock: numberValue(formData, "white_spice_stock"),
    notes: text(formData, "notes") || null,
    updated_by: user.id,
  };

  const { data: existing } = await supabase
    .from("daily_spice_reports")
    .select("id")
    .eq("report_date", reportDate)
    .eq("store_id", store.id)
    .maybeSingle();

  if (existing?.id) {
    await supabase.from("daily_spice_reports").update(payload).eq("id", existing.id);
  } else {
    await supabase.from("daily_spice_reports").insert({ ...payload, created_by: user.id });
  }

  revalidatePath("/reports/spices");
  revalidatePath("/reports/daily");
  redirect(`/reports/spices?date=${reportDate}&store=${store.id}&saved=1`);
}

export async function deleteDailySpiceReport(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile || profile.role !== "admin") redirect("/dashboard");

  const id = text(formData, "id");
  const redirectTo = text(formData, "redirect_to") || "/reports/spices";
  if (id) {
    await supabase.from("daily_spice_reports").delete().eq("id", id);
  }

  revalidatePath("/reports/spices");
  revalidatePath("/reports/daily");
  redirect(`${redirectTo}${redirectTo.includes("?") ? "&" : "?"}deleted=1`);
}
