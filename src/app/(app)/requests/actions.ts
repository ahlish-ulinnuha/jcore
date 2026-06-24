"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

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

export async function deletePurchaseRequest(formData: FormData) {
  const supabase = await requireAdmin();
  const id = text(formData, "id");
  if (!id) redirect("/dashboard");

  await supabase.from("purchase_requests").delete().eq("id", id);
  revalidatePath("/dashboard");
  revalidatePath("/reports/daily");
  redirect("/dashboard?deleted=1");
}

export async function updatePurchaseRequestStatus(formData: FormData) {
  const supabase = await requireAdmin();
  const id = text(formData, "id");
  const status = text(formData, "status");
  const redirectTo = text(formData, "redirect_to") || "/dashboard";
  const allowedStatuses = ["draft", "submitted", "cancelled"];
  if (!id || !allowedStatuses.includes(status)) redirect(redirectTo);

  await supabase.from("purchase_requests").update({ status }).eq("id", id);
  revalidatePath("/dashboard");
  revalidatePath("/reports/daily");
  redirect(`${redirectTo}${redirectTo.includes("?") ? "&" : "?"}updated=1`);
}
