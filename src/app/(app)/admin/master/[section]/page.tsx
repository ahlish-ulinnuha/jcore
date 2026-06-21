import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { productDisplayName } from "@/lib/format";
import type { Brand, Product, ProductVendor, Profile, Store, Vendor } from "@/lib/types";
import {
  createBrand,
  createProduct,
  createProductVendor,
  createStore,
  deleteBrand,
  deleteProduct,
  deleteProductVendor,
  deleteProfile,
  deleteStore,
  resetAllProfilePasswords,
  resetProfilePassword,
  updateBrand,
  updateProduct,
  updateProductVendor,
  updateStore,
  upsertProfile,
} from "../actions";

type Params = Promise<{ section: string }>;
type SearchParams = Promise<{ active?: string; page?: string; page_size?: string; q?: string; role?: string; store?: string }>;
type Section = "barang" | "store" | "brand" | "mapping-vendor" | "user";
type ProductVendorRow = ProductVendor & { products?: Product | null };

const sectionTitles: Record<Section, string> = {
  barang: "Barang",
  store: "Store",
  brand: "Brand",
  "mapping-vendor": "Mapping Vendor",
  user: "User",
};

const pageSizeOptions = [10, 20, 50, 100];

function isSection(value: string): value is Section {
  return ["barang", "store", "brand", "mapping-vendor", "user"].includes(value);
}

function paginate<T>(rows: T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  return {
    currentPage,
    totalPages,
    rows: rows.slice((currentPage - 1) * pageSize, currentPage * pageSize),
  };
}

function filterActive<T extends { is_active: boolean }>(rows: T[], active: string) {
  if (active === "active") return rows.filter((row) => row.is_active);
  if (active === "inactive") return rows.filter((row) => !row.is_active);
  return rows;
}

function Pagination({ currentPage, params, totalPages }: { currentPage: number; params: URLSearchParams; totalPages: number }) {
  const previousParams = new URLSearchParams(params);
  previousParams.set("page", String(Math.max(1, currentPage - 1)));
  const nextParams = new URLSearchParams(params);
  nextParams.set("page", String(Math.min(totalPages, currentPage + 1)));

  return (
    <div className="pagination">
      <Link className={`button outline ${currentPage <= 1 ? "disabled-link" : ""}`} href={`?${previousParams}`}>
        Previous
      </Link>
      <span className="muted">
        Page {currentPage} of {totalPages}
      </span>
      <Link className={`button outline ${currentPage >= totalPages ? "disabled-link" : ""}`} href={`?${nextParams}`}>
        Next
      </Link>
    </div>
  );
}

function MasterFilter({
  active,
  pageSize,
  q,
  roleFilter,
  section,
  storeFilter,
  storeRows,
}: {
  active: string;
  pageSize: number;
  q: string;
  roleFilter: string;
  section: Section;
  storeFilter: string;
  storeRows: Store[];
}) {
  return (
    <form className="filter-grid master-table-filter">
      <div className="field">
        <label>Search</label>
        <input name="q" defaultValue={q} placeholder="Cari data..." />
      </div>
      {["barang", "store", "brand"].includes(section) ? (
        <div className="field">
          <label>Status</label>
          <select name="active" defaultValue={active}>
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      ) : null}
      {section === "user" ? (
        <>
          <div className="field">
            <label>Role</label>
            <select name="role" defaultValue={roleFilter}>
              <option value="all">All Role</option>
              <option value="admin">admin</option>
              <option value="staff">staff</option>
              <option value="vendor">vendor</option>
            </select>
          </div>
          <div className="field">
            <label>Store</label>
            <select name="store" defaultValue={storeFilter}>
              <option value="all">All Store</option>
              {storeRows.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </div>
        </>
      ) : null}
      <div className="field">
        <label>Rows</label>
        <select name="page_size" defaultValue={pageSize}>
          {pageSizeOptions.map((option) => (
            <option key={option} value={option}>
              {option} row
            </option>
          ))}
        </select>
      </div>
      <input name="page" type="hidden" value="1" />
      <button className="button primary" type="submit">
        Filter
      </button>
    </form>
  );
}

export default async function MasterSectionPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { section: sectionParam } = await params;
  if (!isSection(sectionParam)) redirect("/admin/master");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile || profile.role !== "admin") redirect("/dashboard");

  const query = await searchParams;
  const q = (query.q ?? "").trim().toLowerCase();
  const active = query.active ?? "all";
  const roleFilter = query.role ?? "all";
  const storeFilter = query.store ?? "all";
  const requestedPageSize = Number(query.page_size ?? 10);
  const pageSize = pageSizeOptions.includes(requestedPageSize) ? requestedPageSize : 10;
  const currentPage = Math.max(1, Number(query.page ?? 1) || 1);
  const baseParams = new URLSearchParams();
  if (q) baseParams.set("q", q);
  if (active !== "all") baseParams.set("active", active);
  if (roleFilter !== "all") baseParams.set("role", roleFilter);
  if (storeFilter !== "all") baseParams.set("store", storeFilter);
  baseParams.set("page_size", String(pageSize));

  const [{ data: stores }, { data: brands }, { data: products }, { data: vendors }, { data: profiles }, { data: mappings }] =
    await Promise.all([
      supabase.from("stores").select("*").order("name").returns<Store[]>(),
      supabase.from("brands").select("*").order("name").returns<Brand[]>(),
      supabase.from("products").select("*, brands(*)").order("name").returns<Product[]>(),
      supabase.from("vendors").select("*").order("name").returns<Vendor[]>(),
      supabase.from("profiles").select("*, stores(*)").order("full_name").returns<Profile[]>(),
      supabase.from("product_vendors").select("*, products(*, brands(*)), vendors(*)").order("created_at", { ascending: false }).returns<ProductVendorRow[]>(),
    ]);

  const storeRows = stores ?? [];
  const brandRows = brands ?? [];
  const productRows = products ?? [];
  const vendorRows = vendors ?? [];
  const profileRows = profiles ?? [];
  const mappingRows = mappings ?? [];

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Master Data</p>
          <h1>{sectionTitles[sectionParam]}</h1>
          <p className="muted">Tambah, list, edit, hapus, search, filter, dan pagination data {sectionTitles[sectionParam].toLowerCase()}.</p>
        </div>
      </div>

      {sectionParam === "barang" ? renderProducts({ active, baseParams, brandRows, currentPage, pageSize, productRows, q, storeRows }) : null}
      {sectionParam === "store" ? renderStores({ active, baseParams, currentPage, pageSize, q, storeRows }) : null}
      {sectionParam === "brand" ? renderBrands({ active, baseParams, brandRows, currentPage, pageSize, q, storeRows }) : null}
      {sectionParam === "mapping-vendor" ? renderMappings({ active, baseParams, currentPage, mappingRows, pageSize, productRows, q, roleFilter, storeFilter, storeRows, vendorRows }) : null}
      {sectionParam === "user" ? renderUsers({ active, baseParams, currentPage, pageSize, profileRows, q, roleFilter, storeFilter, storeRows }) : null}
    </>
  );
}

function renderProducts({
  active,
  baseParams,
  brandRows,
  currentPage,
  pageSize,
  productRows,
  q,
  storeRows,
}: {
  active: string;
  baseParams: URLSearchParams;
  brandRows: Brand[];
  currentPage: number;
  pageSize: number;
  productRows: Product[];
  q: string;
  storeRows: Store[];
}) {
  const filtered = filterActive(productRows, active).filter((product) => {
    const text = [product.name, product.sku ?? "", product.brands?.name ?? ""].join(" ").toLowerCase();
    return !q || text.includes(q);
  });
  const page = paginate(filtered, currentPage, pageSize);

  return (
    <>
      <form className="panel form master-add-form" action={createProduct}>
        <h2>Tambah Barang</h2>
        <div className="filter-grid">
          <div className="field"><label>Brand</label><select name="brand_id"><option value="">Tanpa brand</option>{brandRows.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></div>
          <div className="field"><label>SKU</label><input name="sku" /></div>
          <div className="field"><label>Nama Barang</label><input name="name" required /></div>
          <div className="field"><label>Unit</label><input name="unit" defaultValue="pcs" /></div>
          <button className="button primary" type="submit">Tambah Barang</button>
        </div>
      </form>
      <section className="panel">
        <MasterFilter active={active} pageSize={pageSize} q={q} roleFilter="all" section="barang" storeFilter="all" storeRows={storeRows} />
        <div className="table-wrap"><table><thead><tr><th>Barang</th><th>Brand</th><th>SKU</th><th>Unit</th><th>Aktif</th><th>Aksi</th></tr></thead><tbody>
          {page.rows.map((product) => (
            <tr key={product.id}>
              <td><form id={`product-${product.id}`} action={updateProduct} className="inline-edit-form"><input name="id" type="hidden" value={product.id} /><input name="name" defaultValue={product.name} required /></form></td>
              <td><select name="brand_id" form={`product-${product.id}`} defaultValue={product.brand_id ?? ""}><option value="">Tanpa brand</option>{brandRows.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></td>
              <td><input name="sku" form={`product-${product.id}`} defaultValue={product.sku ?? ""} /></td>
              <td><input name="unit" form={`product-${product.id}`} defaultValue={product.unit} /></td>
              <td><input name="is_active" form={`product-${product.id}`} type="checkbox" defaultChecked={product.is_active} /></td>
              <td><div className="row-actions"><button className="button outline" form={`product-${product.id}`} type="submit">Edit</button><form action={deleteProduct}><input name="id" type="hidden" value={product.id} /><button className="button danger" type="submit">Hapus</button></form></div></td>
            </tr>
          ))}
        </tbody></table></div>
        <Pagination currentPage={page.currentPage} params={baseParams} totalPages={page.totalPages} />
      </section>
    </>
  );
}

function renderStores({ active, baseParams, currentPage, pageSize, q, storeRows }: { active: string; baseParams: URLSearchParams; currentPage: number; pageSize: number; q: string; storeRows: Store[] }) {
  const filtered = filterActive(storeRows, active).filter((store) => !q || [store.name, store.code ?? ""].join(" ").toLowerCase().includes(q));
  const page = paginate(filtered, currentPage, pageSize);
  return (
    <>
      <form className="panel form master-add-form" action={createStore}><h2>Tambah Store</h2><div className="filter-grid"><div className="field"><label>Kode</label><input name="code" placeholder="J1" /></div><div className="field"><label>Nama Store</label><input name="name" required placeholder="J1" /></div><button className="button primary" type="submit">Tambah Store</button></div></form>
      <section className="panel"><MasterFilter active={active} pageSize={pageSize} q={q} roleFilter="all" section="store" storeFilter="all" storeRows={storeRows} /><div className="table-wrap"><table><thead><tr><th>Kode</th><th>Store</th><th>Aktif</th><th>Aksi</th></tr></thead><tbody>{page.rows.map((store) => (
        <tr key={store.id}><td><form id={`store-${store.id}`} action={updateStore} className="inline-edit-form"><input name="id" type="hidden" value={store.id} /><input name="code" defaultValue={store.code ?? ""} /></form></td><td><input name="name" form={`store-${store.id}`} defaultValue={store.name} required /></td><td><input name="is_active" form={`store-${store.id}`} type="checkbox" defaultChecked={store.is_active} /></td><td><div className="row-actions"><button className="button outline" form={`store-${store.id}`} type="submit">Edit</button><form action={deleteStore}><input name="id" type="hidden" value={store.id} /><button className="button danger" type="submit">Hapus</button></form></div></td></tr>
      ))}</tbody></table></div><Pagination currentPage={page.currentPage} params={baseParams} totalPages={page.totalPages} /></section>
    </>
  );
}

function renderBrands({ active, baseParams, brandRows, currentPage, pageSize, q, storeRows }: { active: string; baseParams: URLSearchParams; brandRows: Brand[]; currentPage: number; pageSize: number; q: string; storeRows: Store[] }) {
  const filtered = filterActive(brandRows, active).filter((brand) => !q || brand.name.toLowerCase().includes(q));
  const page = paginate(filtered, currentPage, pageSize);
  return (
    <>
      <form className="panel form master-add-form" action={createBrand}><h2>Tambah Brand</h2><div className="filter-grid"><div className="field"><label>Nama Brand</label><input name="name" required placeholder="GOOD EAT" /></div><button className="button primary" type="submit">Tambah Brand</button></div></form>
      <section className="panel"><MasterFilter active={active} pageSize={pageSize} q={q} roleFilter="all" section="brand" storeFilter="all" storeRows={storeRows} /><div className="table-wrap"><table><thead><tr><th>Brand</th><th>Aktif</th><th>Aksi</th></tr></thead><tbody>{page.rows.map((brand) => (
        <tr key={brand.id}><td><form id={`brand-${brand.id}`} action={updateBrand} className="inline-edit-form"><input name="id" type="hidden" value={brand.id} /><input name="name" defaultValue={brand.name} required /></form></td><td><input name="is_active" form={`brand-${brand.id}`} type="checkbox" defaultChecked={brand.is_active} /></td><td><div className="row-actions"><button className="button outline" form={`brand-${brand.id}`} type="submit">Edit</button><form action={deleteBrand}><input name="id" type="hidden" value={brand.id} /><button className="button danger" type="submit">Hapus</button></form></div></td></tr>
      ))}</tbody></table></div><Pagination currentPage={page.currentPage} params={baseParams} totalPages={page.totalPages} /></section>
    </>
  );
}

function renderMappings({ active, baseParams, currentPage, mappingRows, pageSize, productRows, q, roleFilter, storeFilter, storeRows, vendorRows }: { active: string; baseParams: URLSearchParams; currentPage: number; mappingRows: ProductVendorRow[]; pageSize: number; productRows: Product[]; q: string; roleFilter: string; storeFilter: string; storeRows: Store[]; vendorRows: Vendor[] }) {
  const filtered = mappingRows.filter((mapping) => {
    const text = [mapping.products ? productDisplayName(mapping.products) : "", mapping.vendors?.name ?? ""].join(" ").toLowerCase();
    return !q || text.includes(q);
  });
  const page = paginate(filtered, currentPage, pageSize);
  return (
    <>
      <form className="panel form master-add-form" action={createProductVendor}><h2>Tambah Mapping Vendor</h2><div className="filter-grid"><div className="field"><label>Barang</label><select name="product_id" required>{productRows.map((product) => <option key={product.id} value={product.id}>{productDisplayName(product)}</option>)}</select></div><div className="field"><label>Vendor</label><select name="vendor_id" required>{vendorRows.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></div><label className="checkbox-line"><input name="is_default" type="checkbox" />Default vendor</label><button className="button primary" type="submit">Tambah Mapping</button></div></form>
      <section className="panel"><MasterFilter active={active} pageSize={pageSize} q={q} roleFilter={roleFilter} section="mapping-vendor" storeFilter={storeFilter} storeRows={storeRows} /><div className="table-wrap"><table><thead><tr><th>Barang</th><th>Vendor</th><th>Default</th><th>Aksi</th></tr></thead><tbody>{page.rows.map((mapping) => (
        <tr key={mapping.id}><td><form id={`mapping-${mapping.id}`} action={updateProductVendor} className="inline-edit-form"><input name="id" type="hidden" value={mapping.id} /><select name="product_id" defaultValue={mapping.product_id}>{productRows.map((product) => <option key={product.id} value={product.id}>{productDisplayName(product)}</option>)}</select></form></td><td><select name="vendor_id" form={`mapping-${mapping.id}`} defaultValue={mapping.vendor_id}>{vendorRows.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></td><td><input name="is_default" form={`mapping-${mapping.id}`} type="checkbox" defaultChecked={mapping.is_default} /></td><td><div className="row-actions"><button className="button outline" form={`mapping-${mapping.id}`} type="submit">Edit</button><form action={deleteProductVendor}><input name="id" type="hidden" value={mapping.id} /><button className="button danger" type="submit">Hapus</button></form></div></td></tr>
      ))}</tbody></table></div><Pagination currentPage={page.currentPage} params={baseParams} totalPages={page.totalPages} /></section>
    </>
  );
}

function renderUsers({ active, baseParams, currentPage, pageSize, profileRows, q, roleFilter, storeFilter, storeRows }: { active: string; baseParams: URLSearchParams; currentPage: number; pageSize: number; profileRows: Profile[]; q: string; roleFilter: string; storeFilter: string; storeRows: Store[] }) {
  const filtered = profileRows.filter((profile) => {
    const text = [profile.full_name, profile.email ?? "", profile.role, profile.id, profile.stores?.name ?? profile.store_name ?? ""].join(" ").toLowerCase();
    const matchesSearch = !q || text.includes(q);
    const matchesRole = roleFilter === "all" || profile.role === roleFilter;
    const matchesStore = storeFilter === "all" || profile.store_id === storeFilter;
    return matchesSearch && matchesRole && matchesStore;
  });
  const page = paginate(filtered, currentPage, pageSize);
  return (
    <>
      <form className="panel form master-add-form" action={upsertProfile}><h2>Tambah User</h2><p className="muted">Buat email/password user dulu di Supabase Authentication, lalu paste User UID di sini.</p><div className="filter-grid"><div className="field"><label>User UID</label><input name="id" required /></div><div className="field"><label>Email</label><input name="email" type="email" required /></div><div className="field"><label>Nama</label><input name="full_name" required /></div><div className="field"><label>Role</label><select name="role" defaultValue="staff"><option value="admin">admin</option><option value="staff">staff</option><option value="vendor">vendor</option></select></div><div className="field"><label>Store</label><select name="store_id"><option value="">Tidak ada</option>{storeRows.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></div><button className="button primary" type="submit">Tambah User</button></div></form>
      <section className="panel"><MasterFilter active={active} pageSize={pageSize} q={q} roleFilter={roleFilter} section="user" storeFilter={storeFilter} storeRows={storeRows} /><form action={resetAllProfilePasswords} className="table-toolbar"><button className="button outline" type="submit">Reset Password Semua User</button></form><div className="table-wrap"><table><thead><tr><th>Nama</th><th>Email</th><th>Role</th><th>Store</th><th>User ID</th><th>Aksi</th></tr></thead><tbody>{page.rows.map((row) => (
        <tr key={row.id}><td><form id={`profile-${row.id}`} action={upsertProfile} className="inline-edit-form"><input name="id" type="hidden" value={row.id} /><input name="full_name" defaultValue={row.full_name} required /></form></td><td><input name="email" form={`profile-${row.id}`} defaultValue={row.email ?? ""} type="email" /></td><td><select name="role" form={`profile-${row.id}`} defaultValue={row.role}><option value="admin">admin</option><option value="staff">staff</option><option value="vendor">vendor</option></select></td><td><select name="store_id" form={`profile-${row.id}`} defaultValue={row.store_id ?? ""}><option value="">Tidak ada</option>{storeRows.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></td><td>{row.id}</td><td><div className="row-actions"><button className="button outline" form={`profile-${row.id}`} type="submit">Edit</button><form action={resetProfilePassword}><input name="email" type="hidden" value={row.email ?? ""} /><button className="button outline" disabled={!row.email} type="submit" title="Reset password">Reset Password</button></form><form action={deleteProfile}><input name="id" type="hidden" value={row.id} /><button className="button danger" type="submit">Hapus</button></form></div></td></tr>
      ))}</tbody></table></div><Pagination currentPage={page.currentPage} params={baseParams} totalPages={page.totalPages} /></section>
    </>
  );
}
