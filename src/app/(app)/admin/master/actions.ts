"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { allMenuItems } from "@/lib/menu-access";
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

function checked(formData: FormData, key: string) {
  return formData.getAll(key).some((value) => ["1", "on", "true"].includes(String(value)));
}

function numberOrNull(formData: FormData, key: string) {
  const value = text(formData, key);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeAlias(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
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
    latitude: numberOrNull(formData, "latitude"),
    longitude: numberOrNull(formData, "longitude"),
    geofence_radius_m: numberOrNull(formData, "geofence_radius_m") ?? 150,
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
      is_active: checked(formData, "is_active"),
      latitude: numberOrNull(formData, "latitude"),
      longitude: numberOrNull(formData, "longitude"),
      geofence_radius_m: numberOrNull(formData, "geofence_radius_m") ?? 150,
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
      is_active: checked(formData, "is_active"),
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
      is_active: checked(formData, "is_active"),
    })
    .eq("id", text(formData, "id"));
  revalidatePath("/admin/master");
  revalidatePath("/admin/master/barang");
  revalidatePath("/requests/new");
  revalidatePath("/requests/[id]/edit", "page");
  await redirectWithToast("Barang berhasil diubah.", "submit");
}

export async function deleteProduct(formData: FormData) {
  const supabase = await requireAdmin();
  await supabase.from("products").delete().eq("id", text(formData, "id"));
  revalidatePath("/admin/master");
}

export async function upsertProfile(formData: FormData) {
  const supabase = await requireAdmin();
  const profileId = text(formData, "id");
  const storeId = text(formData, "store_id");
  const { data: store } = storeId ? await supabase.from("stores").select("name").eq("id", storeId).single() : { data: null };

  await supabase.from("profiles").upsert({
    id: profileId,
    email: text(formData, "email") || null,
    full_name: text(formData, "full_name"),
    role: text(formData, "role"),
    store_id: storeId || null,
    store_name: store?.name ?? null,
    slack_member_id: text(formData, "slack_member_id") || null,
  });

  if (formData.get("menu_access_form") === "1") {
    const selectedMenuKeys = new Set(formData.getAll("menu_access").map((value) => String(value)));
    await supabase.from("profile_menu_access").upsert(
      allMenuItems.map((item) => ({
        can_access: selectedMenuKeys.has(item.key),
        menu_key: item.key,
        profile_id: profileId,
      })),
      { onConflict: "profile_id,menu_key" },
    );
  }

  revalidatePath("/admin/master");
  revalidatePath("/admin/master/user");
  revalidatePath("/", "layout");
}

export async function updateProfileMenuAccess(formData: FormData) {
  const supabase = await requireAdmin();
  const profileId = text(formData, "profile_id");
  if (!profileId) return;

  const selectedMenuKeys = new Set(formData.getAll("menu_access").map((value) => String(value)));
  const { error } = await supabase.from("profile_menu_access").upsert(
    allMenuItems.map((item) => ({
      can_access: selectedMenuKeys.has(item.key),
      menu_key: item.key,
      profile_id: profileId,
    })),
    { onConflict: "profile_id,menu_key" },
  );

  revalidatePath("/admin/master/user");
  revalidatePath("/", "layout");
  await redirectWithToast(error ? `Akses menu gagal disimpan: ${error.message}` : "Akses menu berhasil disimpan.", error ? "delete" : "submit");
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
        is_default: checked(formData, "is_default"),
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
      is_default: checked(formData, "is_default"),
    })
    .eq("id", text(formData, "id"));
  revalidatePath("/admin/master");
}

export async function deleteProductVendor(formData: FormData) {
  const supabase = await requireAdmin();
  await supabase.from("product_vendors").delete().eq("id", text(formData, "id"));
  revalidatePath("/admin/master");
}

export async function createProductVendorAlias(formData: FormData) {
  const supabase = await requireAdmin();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const aliasName = text(formData, "alias_name");
  const productId = text(formData, "product_id");
  const vendorId = text(formData, "vendor_id");

  await supabase.from("product_vendors").upsert(
    {
      product_id: productId,
      vendor_id: vendorId,
      is_default: false,
    },
    { onConflict: "product_id,vendor_id" },
  );

  await supabase.from("product_vendor_aliases").upsert(
    {
      alias_name: aliasName,
      normalized_alias_name: normalizeAlias(aliasName),
      notes: text(formData, "notes") || null,
      product_id: productId,
      vendor_id: vendorId,
      created_by: user?.id ?? null,
      updated_by: user?.id ?? null,
    },
    { onConflict: "vendor_id,normalized_alias_name" },
  );

  revalidatePath("/admin/master/alias-vendor");
  await redirectWithToast("Alias vendor berhasil disimpan.", "submit");
}

export async function updateProductVendorAlias(formData: FormData) {
  const supabase = await requireAdmin();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const aliasName = text(formData, "alias_name");
  const productId = text(formData, "product_id");
  const vendorId = text(formData, "vendor_id");

  await supabase.from("product_vendors").upsert(
    {
      product_id: productId,
      vendor_id: vendorId,
      is_default: false,
    },
    { onConflict: "product_id,vendor_id" },
  );

  await supabase
    .from("product_vendor_aliases")
    .update({
      alias_name: aliasName,
      normalized_alias_name: normalizeAlias(aliasName),
      notes: text(formData, "notes") || null,
      product_id: productId,
      vendor_id: vendorId,
      is_active: checked(formData, "is_active"),
      updated_by: user?.id ?? null,
    })
    .eq("id", text(formData, "id"));

  revalidatePath("/admin/master/alias-vendor");
}

export async function deleteProductVendorAlias(formData: FormData) {
  const supabase = await requireAdmin();
  await supabase.from("product_vendor_aliases").delete().eq("id", text(formData, "id"));
  revalidatePath("/admin/master/alias-vendor");
}

export async function updateProductVendorPrice(formData: FormData) {
  const supabase = await requireAdmin();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const productId = text(formData, "product_id");
  const vendorId = text(formData, "vendor_id");
  const newPrice = Math.max(0, Number(text(formData, "current_price")) || 0);

  await supabase.from("product_vendors").upsert(
    {
      product_id: productId,
      vendor_id: vendorId,
      is_default: false,
    },
    { onConflict: "product_id,vendor_id" },
  );

  const { data: existing } = await supabase
    .from("product_vendor_prices")
    .select("id, current_price")
    .eq("product_id", productId)
    .eq("vendor_id", vendorId)
    .maybeSingle<{ id: string; current_price: number }>();

  const oldPrice = existing?.current_price == null ? null : Number(existing.current_price);

  if (existing?.id) {
    await supabase
      .from("product_vendor_prices")
      .update({
        current_price: newPrice,
        last_source: "manual",
        updated_by: user?.id ?? null,
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("product_vendor_prices").insert({
      product_id: productId,
      vendor_id: vendorId,
      current_price: newPrice,
      last_source: "manual",
      updated_by: user?.id ?? null,
    });
  }

  if (oldPrice !== newPrice) {
    await supabase.from("product_price_history").insert({
      product_id: productId,
      vendor_id: vendorId,
      old_price: oldPrice,
      new_price: newPrice,
      source: "manual",
      changed_by: user?.id ?? null,
    });
  }

  revalidatePath("/admin/master/harga-vendor");
  await redirectWithToast("Harga vendor berhasil diperbarui.", "submit");
}
