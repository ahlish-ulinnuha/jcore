"use server";

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

  return { supabase, user };
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function optionalNumber(formData: FormData, key: string) {
  const rawValue = text(formData, key);
  if (!rawValue) return null;
  const value = Number(rawValue);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export async function saveAdminVendorItem(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const itemId = text(formData, "item_id");
  const productId = text(formData, "product_id");
  const vendorId = text(formData, "vendor_id");
  const purchasedQty = optionalNumber(formData, "purchased_qty");
  const purchasePrice = optionalNumber(formData, "purchase_price");
  const status = text(formData, "status");
  const vendorNote = text(formData, "vendor_note");

  if (!itemId || !productId || !vendorId) return;

  await supabase
    .from("purchase_request_items")
    .update({
      status: status || "requested",
      vendor_note: vendorNote || null,
    })
    .eq("id", itemId);

  if (purchasedQty !== null || purchasePrice !== null) {
    await supabase
      .from("purchase_request_items")
      .update({
        purchase_price: purchasePrice,
        purchased_qty: purchasedQty,
      })
      .eq("id", itemId);
  }

  if (purchasePrice !== null) {
    const { data: currentPrice } = await supabase
      .from("product_vendor_prices")
      .select("current_price")
      .eq("product_id", productId)
      .eq("vendor_id", vendorId)
      .maybeSingle<{ current_price: number }>();
    const oldPrice = currentPrice?.current_price ?? null;

    await supabase.from("product_vendor_prices").upsert(
      {
        current_price: purchasePrice,
        last_source: "admin_vendor",
        last_source_id: itemId,
        product_id: productId,
        updated_by: user.id,
        vendor_id: vendorId,
      },
      { onConflict: "product_id,vendor_id" },
    );

    if (oldPrice !== purchasePrice) {
      await supabase.from("product_price_history").insert({
        changed_by: user.id,
        new_price: purchasePrice,
        old_price: oldPrice,
        product_id: productId,
        source: "admin_vendor",
        source_id: itemId,
        vendor_id: vendorId,
      });
    }
  }

  revalidatePath("/admin/vendor");
}
