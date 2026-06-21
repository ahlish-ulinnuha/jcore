import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, PurchaseRequestItem } from "@/lib/types";
import { VendorPortal } from "./VendorPortal";

export default async function VendorPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile || profile.role !== "vendor") redirect("/dashboard");

  const { data: vendorUser } = await supabase.from("vendor_users").select("vendor_id").eq("user_id", user.id).single();
  if (!vendorUser) {
    return (
      <section className="panel">
        <h1>Vendor belum terhubung</h1>
        <p className="muted">Akun ini belum dikaitkan dengan master vendor.</p>
      </section>
    );
  }

  const { data: items } = await supabase
    .from("purchase_request_items")
    .select("*, products(*, brands(*)), vendors(*), purchase_requests!inner(request_no, request_date, batch_no, store_name, status)")
    .eq("vendor_id", vendorUser.vendor_id)
    .eq("purchase_requests.status", "submitted")
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<PurchaseRequestItem[]>();

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Vendor portal</p>
          <h1>Update ketersediaan item</h1>
          <p className="muted">Ubah status barang dan unggah struk untuk item yang dipenuhi.</p>
        </div>
      </div>
      <VendorPortal items={items ?? []} />
    </>
  );
}
