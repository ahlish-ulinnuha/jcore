"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendWhatsappMessageTo } from "@/lib/whatsapp";
import type { Profile, Vendor } from "@/lib/types";

export type SendVendorMessageResult = { ok: true } | { ok: false; error: string };

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
      request_date: requestDate,
      sent_by: user.id,
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
    request_date: requestDate,
    sent_by: user.id,
    status: result.ok ? "success" : "failed",
    vendor_id: vendorId,
  });

  revalidatePath("/reports/daily");
  return result;
}
