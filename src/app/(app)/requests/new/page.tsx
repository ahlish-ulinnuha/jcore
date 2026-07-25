import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Product, Profile } from "@/lib/types";
import { NewRequestForm } from "./NewRequestForm";

const requestProductSelect = "id, brand_id, sku, name, unit, is_active, brands(id, name, is_active), product_vendors(id, product_id, vendor_id, is_default)";

export default async function NewRequestPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*, stores(*)").eq("id", user.id).single<Profile>();
  if (!profile || profile.role === "vendor") redirect("/dashboard");

  const { data: products } = await supabase
    .from("products")
    .select(requestProductSelect)
    .eq("is_active", true)
    .order("name")
    .returns<Product[]>();

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Request baru</p>
          <h1>Buat purchase request</h1>
          <p className="muted">Satu hari bisa memiliki beberapa request terpisah sesuai kebutuhan toko.</p>
        </div>
      </div>

      {products?.length ? (
        <NewRequestForm
          products={products}
          profileName={profile.full_name}
          userId={user.id}
          storeId={profile.store_id}
          storeName={profile.stores?.name ?? profile.store_name ?? "Toko Utama"}
        />
      ) : (
        <section className="panel">
          <h2>Master data belum lengkap</h2>
          <p className="muted">Isi dulu master barang di Supabase sebelum membuat request.</p>
        </section>
      )}
    </>
  );
}
