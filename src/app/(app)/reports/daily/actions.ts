"use server";

import { revalidatePath } from "next/cache";
import { allowedMenuKeysForRole, hasMenuAccess } from "@/lib/menu-access";
import { sendSlackMessage } from "@/lib/slack";
import { createClient } from "@/lib/supabase/server";
import { sendWhatsappMessageTo } from "@/lib/whatsapp";
import type { Profile, ProfileMenuAccess, Vendor } from "@/lib/types";

export type SendVendorMessageResult = { ok: true } | { ok: false; error: string };
export type SendSlackSummaryResult = { ok: true } | { ok: false; error: string };

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  return digits;
}

export async function sendVendorRequestMessage(formData: FormData): Promise<SendVendorMessageResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Anda belum login.", ok: false };

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile || profile.role === "vendor") return { error: "Tidak diizinkan.", ok: false };

  const { data: menuAccessRows } = await supabase
    .from("profile_menu_access")
    .select("*")
    .eq("profile_id", profile.id)
    .returns<ProfileMenuAccess[]>();
  const allowedMenuKeys = allowedMenuKeysForRole(profile.role, menuAccessRows ?? []);
  if (!hasMenuAccess("send_vendor_message", allowedMenuKeys)) {
    return { error: "Anda belum memiliki akses untuk mengirim pesan ke vendor.", ok: false };
  }

  const vendorId = text(formData, "vendor_id");
  const requestDate = text(formData, "request_date");
  const batchNo = Number(text(formData, "batch_no")) || 0;
  const message = text(formData, "message");
  if (!vendorId || !requestDate || !message) return { error: "Data pesan tidak lengkap.", ok: false };

  const { data: vendor } = await supabase.from("vendors").select("*").eq("id", vendorId).single<Vendor>();
  if (!vendor) return { error: "Vendor tidak ditemukan.", ok: false };

  if (!vendor.phone) {
    await supabase.from("vendor_message_logs").insert({
      batch_no: batchNo,
      error_message: "Nomor WhatsApp vendor belum diisi.",
      message,
      phone: null,
      request_date: requestDate,
      sent_by: user.id,
      source: "manual",
      status: "failed",
      vendor_id: vendorId,
    });
    revalidatePath("/reports/daily");
    return { error: "Nomor WhatsApp vendor belum diisi di data vendor.", ok: false };
  }

  const target = normalizePhone(vendor.phone);
  const result = await sendWhatsappMessageTo(target, message);

  await supabase.from("vendor_message_logs").insert({
    batch_no: batchNo,
    error_message: result.ok ? null : result.error,
    message,
    phone: target,
    request_date: requestDate,
    sent_by: user.id,
    source: "manual",
    status: result.ok ? "success" : "failed",
    vendor_id: vendorId,
  });

  revalidatePath("/reports/daily");
  return result;
}

export async function sendSummaryToSlack(formData: FormData): Promise<SendSlackSummaryResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Anda belum login.", ok: false };

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile || profile.role === "vendor") return { error: "Tidak diizinkan.", ok: false };

  const message = text(formData, "message");
  if (!message) return { error: "Tidak ada summary untuk dikirim.", ok: false };

  const channel = process.env.DAILY_REPORT_CHANNEL_ID;
  const result = await sendSlackMessage(message, channel);
  if (!result.ok) return { error: result.error, ok: false };

  return { ok: true };
}
