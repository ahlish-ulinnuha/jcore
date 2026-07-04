"use server";

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

  const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
  if (!scriptUrl) redirect("/shopping?error=missing-script-url");

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
  const commandText = `/belanja @${description} @${totalPrice} @${category}`;
  const payload = {
    category,
    catatan: notes,
    description,
    kategori: category,
    message: commandText,
    metode_pembayaran: paymentMethod,
    nominal: totalPrice,
    notes,
    payment_method: paymentMethod,
    payment_status: paymentStatus,
    record_date: recordDate,
    source: "jcore-web",
    status_pembayaran: paymentStatus,
    store: store.code || store.name,
    store_code: store.code,
    store_id: store.id,
    store_name: store.name,
    tanggal: recordDate,
    date: recordDate,
    text: commandText,
    token: process.env.GOOGLE_APPS_SCRIPT_TOKEN ?? "",
    data: {
      category,
      command_text: commandText,
      description,
      notes: notes || null,
      payment_method: paymentMethod,
      payment_status: paymentStatus,
      record_date: recordDate,
      recorded_by_email: profile.email ?? user.email ?? null,
      recorded_by_id: user.id,
      recorded_by_name: profile.full_name,
      store_code: store.code,
      store_id: store.id,
      store_name: store.name,
      total_price: totalPrice,
    },
  };

  const requestBody = JSON.stringify(payload);
  console.info("[shopping] sending to Google Apps Script", {
    commandText,
    payload,
    requestBody,
    scriptUrl,
  });

  let response: Response;
  try {
    response = await fetch(scriptUrl, {
      body: requestBody,
      cache: "no-store",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      method: "POST",
      redirect: "follow",
    });
  } catch {
    redirect("/shopping?error=fetch-failed");
  }

  if (!response.ok) {
    redirect(`/shopping?error=script-failed&status=${response.status}`);
  }

  const responseText = await response.text();
  console.info("[shopping] Google Apps Script response", {
    body: responseText,
    status: response.status,
  });

  const redirectParams = new URLSearchParams();
  redirectParams.set("saved", "1");
  redirectParams.set("store", store.id);
  redirect(`/shopping?${redirectParams}`);
}
