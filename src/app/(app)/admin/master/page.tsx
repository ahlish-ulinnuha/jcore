import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

const masterMenus = [
  { href: "/admin/master/barang", title: "Barang", description: "Tambah, list, edit, hapus master barang." },
  { href: "/admin/master/store", title: "Store", description: "Tambah store, list store, edit, hapus." },
  { href: "/admin/master/brand", title: "Brand", description: "Tambah, list, edit, hapus brand." },
  { href: "/admin/master/mapping-vendor", title: "Mapping Vendor", description: "Kelola mapping barang ke vendor." },
  { href: "/admin/master/user", title: "User", description: "Kelola profile user staff, admin, dan vendor." },
];

export default async function MasterDataIndexPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile || profile.role !== "admin") redirect("/dashboard");

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Master Data</h1>
          <p className="muted">Pilih salah satu master data untuk tambah, list, edit, hapus, search, filter, dan pagination.</p>
        </div>
      </div>

      <section className="grid cols-3">
        {masterMenus.map((menu) => (
          <Link className="panel master-card" href={menu.href} key={menu.href}>
            <h2>{menu.title}</h2>
            <p className="muted">{menu.description}</p>
          </Link>
        ))}
      </section>
    </>
  );
}
