"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Store } from "@/lib/types";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function numberValue(formData: FormData, key: string) {
  const value = Number(text(formData, key));
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function commandValue(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export async function saveShoppingRecord(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*, stores(*)").eq("id", user.id).single<Profile>();
  if (!profile || profile.role === "vendor") redirect("/dashboard");

  const selectedStoreId = profile.role === "admin" ? text(formData, "store_id") : profile.store_id ?? "";
  if (!selectedStoreId) redirect("/shopping?error=missing-store");

  const { data: store } = await supabase.from("stores").select("*").eq("id", selectedStoreId).single<Store>();
  if (!store) redirect("/shopping?error=missing-store");

  const totalPrice = numberValue(formData, "total_price");
  const description = commandValue(text(formData, "description"));
  const category = text(formData, "category") || "belanja";
  const notes = text(formData, "notes");
  const paymentMethod = text(formData, "payment_method") || "cash";
  const paymentStatus = text(formData, "payment_status") || "unpaid";
  const recordDate = text(formData, "record_date");
  if (!recordDate || !description) redirect("/shopping?error=missing-store");

  const { error: insertError } = await supabase.from("shopping_records").insert({
    category,
    created_by: user.id,
    description,
    notes: notes || null,
    payment_method: paymentMethod,
    payment_status: paymentStatus,
    record_date: recordDate,
    store_code: store.code,
    store_id: store.id,
    store_name: store.name,
    total_price: totalPrice,
  });

  if (insertError) {
    redirect(`/shopping?error=save-failed`);
  }

  revalidatePath("/shopping");
  const redirectParams = new URLSearchParams();
  redirectParams.set("saved", "1");
  redirectParams.set("store", store.id);
  redirect(`/shopping?${redirectParams}`);
}

export async function deleteShoppingRecord(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile || profile.role !== "admin") redirect("/dashboard");

  const id = text(formData, "id");
  if (id) {
    await supabase.from("shopping_records").delete().eq("id", id);
  }

  revalidatePath("/shopping");
  redirect("/shopping?deleted=1");
}
