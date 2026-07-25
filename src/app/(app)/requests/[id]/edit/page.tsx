import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ActivityLog, Product, Profile, PurchaseRequest, PurchaseRequestItem } from "@/lib/types";
import { NewRequestForm } from "../../new/NewRequestForm";
import { deletePurchaseRequest } from "../../actions";

type Params = Promise<{ id: string }>;

const requestProductSelect = "id, brand_id, sku, name, unit, is_active, brands(id, name, is_active), product_vendors(id, product_id, vendor_id, is_default)";

export default async function EditRequestPage({ params }: { params: Params }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile || profile.role === "vendor") redirect("/dashboard");

  const { id } = await params;
  const [{ data: request }, { data: requestItems }, { data: products }, { data: activityLogs }] = await Promise.all([
    supabase.from("purchase_requests").select("*").eq("id", id).single<PurchaseRequest>(),
    supabase.from("purchase_request_items").select("*, products(*, brands(*)), vendors(*)").eq("request_id", id).returns<PurchaseRequestItem[]>(),
    supabase.from("products").select(requestProductSelect).eq("is_active", true).order("name").returns<Product[]>(),
    supabase
      .from("activity_logs")
      .select("*")
      .eq("entity_type", "purchase_request")
      .eq("entity_id", id)
      .order("created_at", { ascending: false })
      .returns<ActivityLog[]>(),
  ]);

  if (!request) redirect("/dashboard");

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Edit request</p>
          <h1>
            {request.request_no} · Batch {request.batch_no}
          </h1>
          <p className="muted">Draft bisa diedit. Request yang sudah submitted dikunci agar vendor menerima data final.</p>
        </div>
        {profile.role === "admin" ? (
          <form action={deletePurchaseRequest}>
            <input name="id" type="hidden" value={request.id} />
            <button className="button danger" type="submit">
              Hapus Request
            </button>
          </form>
        ) : null}
      </div>

      {products?.length ? (
        <NewRequestForm
          activityLogs={activityLogs ?? []}
          products={products}
          profileName={profile.full_name}
          userId={user.id}
          storeId={request.store_id}
          storeName={request.store_name}
          request={request}
          requestItems={requestItems ?? []}
        />
      ) : (
        <section className="panel">
          <h2>Master data belum lengkap</h2>
          <p className="muted">Isi dulu master barang, mapping vendor, dan vendor di Supabase.</p>
        </section>
      )}
    </>
  );
}
