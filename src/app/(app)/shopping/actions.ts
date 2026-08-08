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

  const editId = text(formData, "id");
  if (editId && profile.role !== "admin") redirect("/dashboard");

  const selectedStoreId = profile.role === "admin" ? text(formData, "store_id") : profile.store_id ?? "";
  if (!selectedStoreId) redirect("/shopping?error=missing-store");

  const { data: store } = await supabase.from("stores").select("*").eq("id", selectedStoreId).single<Store>();
  if (!store) redirect("/shopping?error=missing-store");

  const totalPrice = numberValue(formData, "total_price");
  const description = commandValue(text(formData, "description"));
  const category = text(formData, "category") || "belanja";
  const notes = text(formData, "notes");
  const paymentMethod = text(formData, "payment_method") || "cash";
  const paymentStatus = text(formData, "payment_status") || "paid";
  const recordDate = text(formData, "record_date");
  if (!recordDate || !description) redirect("/shopping?error=missing-store");

  const payload = {
    category,
    description,
    notes: notes || null,
    payment_method: paymentMethod,
    payment_status: paymentStatus,
    record_date: recordDate,
    store_code: store.code,
    store_id: store.id,
    store_name: store.name,
    total_price: totalPrice,
  };

  const { error: saveError } = editId
    ? await supabase.from("shopping_records").update(payload).eq("id", editId)
    : await supabase.from("shopping_records").insert({ ...payload, created_by: user.id });

  if (saveError) {
    redirect(`/shopping?error=save-failed`);
  }

  revalidatePath("/shopping");
  const redirectParams = new URLSearchParams();
  redirectParams.set("saved", "1");
  redirectParams.set("store", store.id);
  redirect(`/shopping?${redirectParams}`);
}

type SheetImportRow = {
  description: string;
  kategori: string;
  nominal: number;
  notes: string;
  paymentMethod: string;
  paymentStatus: string;
  recordDate: string;
  storeCode: string;
  storeId: string;
  storeName: string;
};

function fieldValue(row: Record<string, unknown>, keys: string[]) {
  const normalizedEntries = Object.entries(row).map(([key, value]) => [key.toLowerCase(), value] as const);
  for (const key of keys) {
    const match = normalizedEntries.find(([entryKey]) => entryKey === key.toLowerCase());
    if (match) return match[1];
  }
  return "";
}

function nestedDataValue(row: Record<string, unknown>, keys: string[]) {
  const data = row.data;
  if (!data || typeof data !== "object") return "";
  return fieldValue(data as Record<string, unknown>, keys);
}

function normalizeDateToIso(value: string) {
  const yyyymmdd = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (yyyymmdd) return `${yyyymmdd[1]}-${yyyymmdd[2]}-${yyyymmdd[3]}`;

  const ddmmyyyy = value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { day: "2-digit", month: "2-digit", timeZone: "Asia/Jakarta", year: "numeric" }).format(date);
}

function normalizeSheetImportRows(rawRows: unknown): SheetImportRow[] {
  if (!Array.isArray(rawRows)) return [];

  return rawRows
    .map((row) => {
      if (Array.isArray(row)) {
        const hasPaymentStoreColumns = row.length >= 8;
        return {
          description: String(row[1] ?? ""),
          kategori: String(row[3] ?? ""),
          nominal: Number(row[2] ?? 0),
          notes: "",
          paymentMethod: hasPaymentStoreColumns ? String(row[4] ?? "") : "",
          paymentStatus: "",
          recordDate: normalizeDateToIso(String(row[0] ?? "")),
          storeCode: hasPaymentStoreColumns ? String(row[5] ?? "") : "",
          storeId: "",
          storeName: hasPaymentStoreColumns ? String(row[5] ?? "") : "",
        };
      }

      if (row && typeof row === "object") {
        const record = row as Record<string, unknown>;
        return {
          description: String(fieldValue(record, ["deskripsi", "description"]) ?? ""),
          kategori: String(fieldValue(record, ["kategori", "category"]) ?? ""),
          nominal: Number(fieldValue(record, ["nominal", "amount", "total"]) ?? 0),
          notes: String(fieldValue(record, ["catatan", "notes", "note"]) ?? ""),
          paymentMethod: String(fieldValue(record, ["metode pembayaran", "payment_method", "paymentMethod", "payment"]) ?? ""),
          paymentStatus: String(
            fieldValue(record, ["status pembayaran", "status_pembayaran", "payment_status", "paymentStatus", "status bayar"]) ||
              nestedDataValue(record, ["payment_status", "paymentStatus"]) ||
              "",
          ),
          recordDate: normalizeDateToIso(String(fieldValue(record, ["tanggal", "date", "created_at"]) ?? "")),
          storeCode: String(fieldValue(record, ["store_code", "storeCode", "kode store", "kode toko"]) || nestedDataValue(record, ["store_code", "storeCode"]) || ""),
          storeId: String(fieldValue(record, ["store_id", "storeId"]) || nestedDataValue(record, ["store_id", "storeId"]) || ""),
          storeName: String(fieldValue(record, ["store_name", "storeName", "store", "toko"]) || nestedDataValue(record, ["store_name", "storeName"]) || ""),
        };
      }

      return null;
    })
    .filter((row): row is SheetImportRow => Boolean(row && row.recordDate && (row.description || row.nominal || row.kategori)));
}

export type ImportShoppingResult =
  | { ok: true; imported: number; skipped: number }
  | { ok: false; error: string };

export async function importShoppingRecordsFromSheet(): Promise<ImportShoppingResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Anda belum login.", ok: false };

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile || profile.role !== "admin") return { error: "Tidak diizinkan.", ok: false };

  const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
  if (!scriptUrl) return { error: "GOOGLE_APPS_SCRIPT_URL belum diisi di environment.", ok: false };

  const url = new URL(scriptUrl);
  url.searchParams.set("action", "list_shopping_records");
  url.searchParams.set("limit", "5000");
  const token = process.env.GOOGLE_APPS_SCRIPT_TOKEN ?? "";
  if (token) url.searchParams.set("token", token);

  let sheetRows: SheetImportRow[];
  try {
    const response = await fetch(url, { cache: "no-store", redirect: "follow" });
    const text = await response.text();
    if (!response.ok) return { error: `Google Apps Script gagal mengambil data (${response.status}).`, ok: false };
    const json = JSON.parse(text) as Record<string, unknown>;
    const rawRows = json.records ?? json.rows ?? json.data ?? json.values;
    sheetRows = normalizeSheetImportRows(rawRows);
  } catch {
    return { error: "Gagal membaca data dari Google Apps Script.", ok: false };
  }

  if (sheetRows.length === 0) return { imported: 0, ok: true, skipped: 0 };

  const { data: stores } = await supabase.from("stores").select("*").returns<Store[]>();
  const storeById = new Map<string, Store>((stores ?? []).map((store) => [store.id, store]));
  const storeByCode = new Map<string, Store>(
    (stores ?? [])
      .filter((store) => store.code)
      .map((store) => [store.code!.trim().toLowerCase(), store]),
  );
  const storeByName = new Map<string, Store>((stores ?? []).map((store) => [store.name.trim().toLowerCase(), store]));

  function resolveStore(row: SheetImportRow) {
    if (row.storeId && storeById.has(row.storeId)) return storeById.get(row.storeId)!;
    const byCode = row.storeCode ? storeByCode.get(row.storeCode.trim().toLowerCase()) : undefined;
    if (byCode) return byCode;
    const byName = row.storeName ? storeByName.get(row.storeName.trim().toLowerCase()) : undefined;
    if (byName) return byName;
    return null;
  }

  const { data: existingRecords } = await supabase.from("shopping_records").select("store_id, record_date, description, total_price");
  const existingKeys = new Set(
    (existingRecords ?? []).map((row) => `${row.store_id}|${row.record_date}|${row.description}|${row.total_price}`),
  );

  const toInsert: Record<string, unknown>[] = [];
  let skipped = 0;

  for (const row of sheetRows) {
    const store = resolveStore(row);
    if (!store) {
      skipped += 1;
      continue;
    }

    const key = `${store.id}|${row.recordDate}|${row.description}|${row.nominal}`;
    if (existingKeys.has(key)) {
      skipped += 1;
      continue;
    }
    existingKeys.add(key);

    toInsert.push({
      category: row.kategori || "belanja",
      created_by: user.id,
      description: row.description || "-",
      notes: row.notes || null,
      payment_method: row.paymentMethod || "cash",
      payment_status: row.paymentStatus.toLowerCase() === "paid" ? "paid" : "unpaid",
      record_date: row.recordDate,
      store_code: store.code,
      store_id: store.id,
      store_name: store.name,
      total_price: row.nominal,
    });
  }

  if (toInsert.length > 0) {
    const { error: insertError } = await supabase.from("shopping_records").insert(toInsert);
    if (insertError) return { error: insertError.message, ok: false };
  }

  revalidatePath("/shopping");
  return { imported: toInsert.length, ok: true, skipped };
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
