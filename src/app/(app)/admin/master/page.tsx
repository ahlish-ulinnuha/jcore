import Link from "next/link";
import { redirect } from "next/navigation";
import { allowedMenuKeysForRole, masterMenuItems } from "@/lib/menu-access";
import { createClient } from "@/lib/supabase/server";
import type { Profile, ProfileMenuAccess } from "@/lib/types";

const masterMenus = [
  { description: "Tambah, list, edit, hapus master barang.", key: "master_barang", title: "Barang" },
  { description: "Tambah store, list store, edit, hapus.", key: "master_store", title: "Store" },
  { description: "Tambah, list, edit, hapus brand.", key: "master_brand", title: "Brand" },
  { description: "Kelola mapping barang ke vendor.", key: "master_mapping_vendor", title: "Mapping Vendor" },
  { description: "Kelola nama barang versi struk vendor ke master barang.", key: "master_alias_vendor", title: "Alias Vendor" },
  { description: "Kelola harga vendor terkini dan lihat histori perubahan harga.", key: "master_harga_vendor", title: "Harga Vendor" },
  { description: "Kelola profile user staff, admin, dan vendor.", key: "master_user", title: "User" },
] as const;

export default async function MasterDataIndexPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile || profile.role !== "admin") redirect("/dashboard");
  const { data: menuAccessRows } = await supabase.from("profile_menu_access").select("*").eq("profile_id", profile.id).returns<ProfileMenuAccess[]>();
  const allowedMenuKeys = allowedMenuKeysForRole(profile.role, menuAccessRows ?? []);
  const visibleMasterMenus = masterMenus
    .filter((menu) => allowedMenuKeys.includes(menu.key))
    .map((menu) => ({
      ...menu,
      href: masterMenuItems.find((item) => item.key === menu.key)?.href ?? "/admin/master",
    }));

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
        {visibleMasterMenus.map((menu) => (
          <Link className="panel master-card" href={menu.href} key={menu.href}>
            <h2>{menu.title}</h2>
            <p className="muted">{menu.description}</p>
          </Link>
        ))}
      </section>
    </>
  );
}
