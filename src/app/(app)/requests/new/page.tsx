import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Product, Profile, Vendor } from "@/lib/types";
import { NewRequestForm } from "./NewRequestForm";

export default async function NewRequestPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*, stores(*)").eq("id", user.id).single<Profile>();
  if (!profile || profile.role === "vendor") redirect("/dashboard");

  const [{ data: products }, { data: vendors }] = await Promise.all([
    supabase.from("products").select("*, brands(*), product_vendors(*, vendors(*))").eq("is_active", true).order("name").returns<Product[]>(),
    supabase.from("vendors").select("*").eq("is_active", true).order("name").returns<Vendor[]>(),
  ]);

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Request baru</p>
          <h1>Buat purchase request</h1>
          <p className="muted">Satu hari bisa memiliki beberapa request terpisah sesuai kebutuhan toko.</p>
        </div>
      </div>

      {products?.length && vendors?.length ? (
        <NewRequestForm
          products={products}
          profileName={profile.full_name}
          vendors={vendors}
          userId={user.id}
          storeId={profile.store_id}
          storeName={profile.stores?.name ?? profile.store_name ?? "Toko Utama"}
        />
      ) : (
        <section className="panel">
          <h2>Master data belum lengkap</h2>
          <p className="muted">Isi dulu master barang dan vendor di Supabase sebelum membuat request.</p>
        </section>
      )}
    </>
  );
}
