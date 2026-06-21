"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile || profile.role !== "admin") redirect("/dashboard");
  return supabase;
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

async function redirectWithToast(message: string, tone: "draft" | "submit" | "delete" = "submit") {
  const headerList = await headers();
  const referer = headerList.get("referer") ?? "/admin/master";
  const url = new URL(referer, "http://localhost");
  url.searchParams.set("toast", message);
  url.searchParams.set("tone", tone);
  redirect(`${url.pathname}?${url.searchParams.toString()}`);
}

export async function createStore(formData: FormData) {
  const supabase = await requireAdmin();
  await supabase.from("stores").insert({
    name: text(formData, "name"),
    code: text(formData, "code") || null,
  });
  revalidatePath("/admin/master");
}

export async function updateStore(formData: FormData) {
  const supabase = await requireAdmin();
  await supabase
    .from("stores")
    .update({
      name: text(formData, "name"),
      code: text(formData, "code") || null,
      is_active: formData.get("is_active") === "on",
    })
    .eq("id", text(formData, "id"));
  revalidatePath("/admin/master");
}

export async function deleteStore(formData: FormData) {
  const supabase = await requireAdmin();
  await supabase.from("stores").delete().eq("id", text(formData, "id"));
  revalidatePath("/admin/master");
}

export async function createBrand(formData: FormData) {
  const supabase = await requireAdmin();
  await supabase.from("brands").insert({ name: text(formData, "name") });
  revalidatePath("/admin/master");
}

export async function updateBrand(formData: FormData) {
  const supabase = await requireAdmin();
  await supabase
    .from("brands")
    .update({
      name: text(formData, "name"),
      is_active: formData.get("is_active") === "on",
    })
    .eq("id", text(formData, "id"));
  revalidatePath("/admin/master");
}

export async function deleteBrand(formData: FormData) {
  const supabase = await requireAdmin();
  await supabase.from("brands").delete().eq("id", text(formData, "id"));
  revalidatePath("/admin/master");
}

export async function createProduct(formData: FormData) {
  const supabase = await requireAdmin();
  const brandId = text(formData, "brand_id");
  await supabase.from("products").insert({
    brand_id: brandId || null,
    sku: text(formData, "sku") || null,
    name: text(formData, "name"),
    unit: text(formData, "unit") || "pcs",
  });
  revalidatePath("/admin/master");
  await redirectWithToast("Barang berhasil ditambahkan.", "submit");
}

export async function updateProduct(formData: FormData) {
  const supabase = await requireAdmin();
  const brandId = text(formData, "brand_id");
  await supabase
    .from("products")
    .update({
      brand_id: brandId || null,
      sku: text(formData, "sku") || null,
      name: text(formData, "name"),
      unit: text(formData, "unit") || "pcs",
      is_active: formData.get("is_active") === "on",
    })
    .eq("id", text(formData, "id"));
  revalidatePath("/admin/master");
}

export async function deleteProduct(formData: FormData) {
  const supabase = await requireAdmin();
  await supabase.from("products").delete().eq("id", text(formData, "id"));
  revalidatePath("/admin/master");
}

export async function upsertProfile(formData: FormData) {
  const supabase = await requireAdmin();
  const storeId = text(formData, "store_id");
  const { data: store } = storeId ? await supabase.from("stores").select("name").eq("id", storeId).single() : { data: null };

  await supabase.from("profiles").upsert({
    id: text(formData, "id"),
    email: text(formData, "email") || null,
    full_name: text(formData, "full_name"),
    role: text(formData, "role"),
    store_id: storeId || null,
    store_name: store?.name ?? null,
  });
  revalidatePath("/admin/master");
}

export async function resetProfilePassword(formData: FormData) {
  const supabase = await requireAdmin();
  const email = text(formData, "email");
  if (!email) return;
  await supabase.auth.resetPasswordForEmail(email);
  revalidatePath("/admin/master/user");
}

export async function resetAllProfilePasswords() {
  const supabase = await requireAdmin();
  const { data: profiles } = await supabase.from("profiles").select("email").not("email", "is", null);
  const emails = Array.from(new Set((profiles ?? []).map((profile) => profile.email).filter(Boolean)));

  await Promise.all(emails.map((email) => supabase.auth.resetPasswordForEmail(email as string)));
  revalidatePath("/admin/master/user");
}

export async function deleteProfile(formData: FormData) {
  const supabase = await requireAdmin();
  await supabase.from("profiles").delete().eq("id", text(formData, "id"));
  revalidatePath("/admin/master");
}

export async function createProductVendor(formData: FormData) {
  const supabase = await requireAdmin();
  await supabase
    .from("product_vendors")
    .upsert(
      {
        product_id: text(formData, "product_id"),
        vendor_id: text(formData, "vendor_id"),
        is_default: formData.get("is_default") === "on",
      },
      { onConflict: "product_id,vendor_id" },
    );
  revalidatePath("/admin/master");
  await redirectWithToast("Mapping vendor berhasil disimpan.", "submit");
}

export async function updateProductVendor(formData: FormData) {
  const supabase = await requireAdmin();
  await supabase
    .from("product_vendors")
    .update({
      product_id: text(formData, "product_id"),
      vendor_id: text(formData, "vendor_id"),
      is_default: formData.get("is_default") === "on",
    })
    .eq("id", text(formData, "id"));
  revalidatePath("/admin/master");
}

export async function deleteProductVendor(formData: FormData) {
  const supabase = await requireAdmin();
  await supabase.from("product_vendors").delete().eq("id", text(formData, "id"));
  revalidatePath("/admin/master");
}
