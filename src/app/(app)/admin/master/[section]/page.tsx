import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { productDisplayName } from "@/lib/format";
import { allMenuItems, defaultMenuKeysForRole } from "@/lib/menu-access";
import type { Brand, Product, ProductPriceHistory, ProductVendor, ProductVendorAlias, ProductVendorPrice, Profile, ProfileMenuAccess, Role, Store, Vendor } from "@/lib/types";
import {
  createBrand,
  createProduct,
  createProductVendorAlias,
  createProductVendor,
  createStore,
  deleteBrand,
  deleteProduct,
  deleteProductVendorAlias,
  deleteProductVendor,
  deleteProfile,
  deleteStore,
  resetAllProfilePasswords,
  resetProfilePassword,
  updateBrand,
  updateProduct,
  updateProductVendorAlias,
  updateProductVendorPrice,
  updateProductVendor,
  updateProfileMenuAccess,
  updateStore,
  upsertProfile,
} from "../actions";
import { MasterSubmitButton } from "./MasterSubmitButton";
import { SearchableSelect } from "./SearchableSelect";

type Params = Promise<{ section: string }>;
type SearchParams = Promise<{ active?: string; page?: string; page_size?: string; q?: string; role?: string; store?: string; toast?: string; tone?: string }>;
type Section = "barang" | "store" | "brand" | "mapping-vendor" | "alias-vendor" | "harga-vendor" | "user";
type ProductVendorRow = ProductVendor & { products?: Product | null };
type ProductVendorAliasRow = ProductVendorAlias & { products?: Product | null; vendors?: Vendor | null };
type ProductVendorPriceRow = ProductVendorPrice & { products?: Product | null; vendors?: Vendor | null };
type ProductPriceHistoryRow = ProductPriceHistory & { products?: Product | null; vendors?: Vendor | null };

const sectionTitles: Record<Section, string> = {
  barang: "Barang",
  store: "Store",
  brand: "Brand",
  "mapping-vendor": "Mapping Vendor",
  "alias-vendor": "Alias Vendor",
  "harga-vendor": "Harga Vendor",
  user: "User",
};

const pageSizeOptions = [10, 20, 50, 100];

function isSection(value: string): value is Section {
  return ["barang", "store", "brand", "mapping-vendor", "alias-vendor", "harga-vendor", "user"].includes(value);
}

function formatRupiah(value: number | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    currency: "IDR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(Number(value ?? 0));
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

function menuKeysForProfileAccess(profileId: string, role: Role, menuAccessRows: ProfileMenuAccess[]) {
  const rows = menuAccessRows.filter((row) => row.profile_id === profileId);
  if (rows.length === 0) return new Set(defaultMenuKeysForRole(role));
  return new Set(rows.filter((row) => row.can_access).map((row) => row.menu_key));
}

function MenuAccessFields({
  checkedKeys,
  formId,
}: {
  checkedKeys: Set<string>;
  formId?: string;
}) {
  return (
    <div className="menu-access-grid">
      <input form={formId} name="menu_access_form" type="hidden" value="1" />
      {allMenuItems.map((item) => (
        <label className="menu-access-option" key={item.key}>
          <input defaultChecked={checkedKeys.has(item.key)} form={formId} name="menu_access" type="checkbox" value={item.key} />
          <span>{item.label}</span>
        </label>
      ))}
    </div>
  );
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
      {["barang", "store", "brand", "alias-vendor"].includes(section) ? (
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
      <Link className="button outline" href={`/admin/master/${section}`}>
        Reset
      </Link>
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
  const toastTone = query.tone === "delete" || query.tone === "draft" || query.tone === "submit" ? query.tone : "submit";
  const baseParams = new URLSearchParams();
  if (q) baseParams.set("q", q);
  if (active !== "all") baseParams.set("active", active);
  if (roleFilter !== "all") baseParams.set("role", roleFilter);
  if (storeFilter !== "all") baseParams.set("store", storeFilter);
  baseParams.set("page_size", String(pageSize));

  const [{ data: stores }, { data: brands }, { data: products }, { data: vendors }, { data: profiles }, { data: menuAccess }, { data: mappings }, { data: aliases }, { data: prices }, { data: priceHistory }] =
    await Promise.all([
      supabase.from("stores").select("*").order("name").returns<Store[]>(),
      supabase.from("brands").select("*").order("name").returns<Brand[]>(),
      supabase.from("products").select("*, brands(*)").order("name").returns<Product[]>(),
      supabase.from("vendors").select("*").order("name").returns<Vendor[]>(),
      supabase.from("profiles").select("*, stores(*)").order("full_name").returns<Profile[]>(),
      supabase.from("profile_menu_access").select("*").returns<ProfileMenuAccess[]>(),
      supabase.from("product_vendors").select("*, products(*, brands(*)), vendors(*)").order("created_at", { ascending: false }).returns<ProductVendorRow[]>(),
      supabase.from("product_vendor_aliases").select("*, products(*, brands(*)), vendors(*)").order("updated_at", { ascending: false }).returns<ProductVendorAliasRow[]>(),
      supabase.from("product_vendor_prices").select("*, products(*, brands(*)), vendors(*)").order("updated_at", { ascending: false }).returns<ProductVendorPriceRow[]>(),
      supabase.from("product_price_history").select("*, products(*, brands(*)), vendors(*)").order("changed_at", { ascending: false }).limit(100).returns<ProductPriceHistoryRow[]>(),
    ]);

  const storeRows = stores ?? [];
  const brandRows = brands ?? [];
  const productRows = products ?? [];
  const vendorRows = vendors ?? [];
  const profileRows = profiles ?? [];
  const menuAccessRows = menuAccess ?? [];
  const mappingRows = mappings ?? [];
  const aliasRows = aliases ?? [];
  const priceRows = prices ?? [];
  const priceHistoryRows = priceHistory ?? [];

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Master Data</p>
          <h1>{sectionTitles[sectionParam]}</h1>
          <p className="muted">Tambah, list, edit, hapus, search, filter, dan pagination data {sectionTitles[sectionParam].toLowerCase()}.</p>
        </div>
      </div>

      {query.toast ? <div className={`toast ${toastTone}`}>{query.toast}</div> : null}

      {sectionParam === "barang" ? renderProducts({ active, baseParams, brandRows, currentPage, pageSize, productRows, q, storeRows }) : null}
      {sectionParam === "store" ? renderStores({ active, baseParams, currentPage, pageSize, q, storeRows }) : null}
      {sectionParam === "brand" ? renderBrands({ active, baseParams, brandRows, currentPage, pageSize, q, storeRows }) : null}
      {sectionParam === "mapping-vendor" ? renderMappings({ active, baseParams, currentPage, mappingRows, pageSize, productRows, q, roleFilter, storeFilter, storeRows, vendorRows }) : null}
      {sectionParam === "alias-vendor" ? renderAliases({ active, aliasRows, baseParams, currentPage, pageSize, productRows, q, roleFilter, storeFilter, storeRows, vendorRows }) : null}
      {sectionParam === "harga-vendor" ? renderVendorPrices({ baseParams, currentPage, pageSize, priceHistoryRows, priceRows, productRows, q, roleFilter, storeFilter, storeRows, vendorRows }) : null}
      {sectionParam === "user" ? renderUsers({ active, baseParams, currentPage, menuAccessRows, pageSize, profileRows, q, roleFilter, storeFilter, storeRows }) : null}
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
          <MasterSubmitButton label="Tambah Barang" pendingLabel="Menambah..." variant="primary" />
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
              <td><input name="is_active" form={`product-${product.id}`} type="hidden" value="false" /><input name="is_active" form={`product-${product.id}`} type="checkbox" defaultChecked={product.is_active} /></td>
              <td><div className="row-actions"><MasterSubmitButton form={`product-${product.id}`} label="Edit" pendingLabel="Menyimpan..." /><form action={deleteProduct}><input name="id" type="hidden" value={product.id} /><MasterSubmitButton label="Hapus" pendingLabel="Menghapus..." variant="danger" /></form></div></td>
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
      <form className="panel form master-add-form" action={createStore}><h2>Tambah Store</h2><div className="filter-grid"><div className="field"><label>Kode</label><input name="code" placeholder="J1" /></div><div className="field"><label>Nama Store</label><input name="name" required placeholder="J1" /></div><MasterSubmitButton label="Tambah Store" pendingLabel="Menambah..." variant="primary" /></div></form>
      <section className="panel"><MasterFilter active={active} pageSize={pageSize} q={q} roleFilter="all" section="store" storeFilter="all" storeRows={storeRows} /><div className="table-wrap"><table><thead><tr><th>Kode</th><th>Store</th><th>Aktif</th><th>Aksi</th></tr></thead><tbody>{page.rows.map((store) => (
        <tr key={store.id}><td><form id={`store-${store.id}`} action={updateStore} className="inline-edit-form"><input name="id" type="hidden" value={store.id} /><input name="code" defaultValue={store.code ?? ""} /></form></td><td><input name="name" form={`store-${store.id}`} defaultValue={store.name} required /></td><td><input name="is_active" form={`store-${store.id}`} type="checkbox" defaultChecked={store.is_active} /></td><td><div className="row-actions"><MasterSubmitButton form={`store-${store.id}`} label="Edit" pendingLabel="Menyimpan..." /><form action={deleteStore}><input name="id" type="hidden" value={store.id} /><MasterSubmitButton label="Hapus" pendingLabel="Menghapus..." variant="danger" /></form></div></td></tr>
      ))}</tbody></table></div><Pagination currentPage={page.currentPage} params={baseParams} totalPages={page.totalPages} /></section>
    </>
  );
}

function renderBrands({ active, baseParams, brandRows, currentPage, pageSize, q, storeRows }: { active: string; baseParams: URLSearchParams; brandRows: Brand[]; currentPage: number; pageSize: number; q: string; storeRows: Store[] }) {
  const filtered = filterActive(brandRows, active).filter((brand) => !q || brand.name.toLowerCase().includes(q));
  const page = paginate(filtered, currentPage, pageSize);
  return (
    <>
      <form className="panel form master-add-form" action={createBrand}><h2>Tambah Brand</h2><div className="filter-grid"><div className="field"><label>Nama Brand</label><input name="name" required placeholder="GOOD EAT" /></div><MasterSubmitButton label="Tambah Brand" pendingLabel="Menambah..." variant="primary" /></div></form>
      <section className="panel"><MasterFilter active={active} pageSize={pageSize} q={q} roleFilter="all" section="brand" storeFilter="all" storeRows={storeRows} /><div className="table-wrap"><table><thead><tr><th>Brand</th><th>Aktif</th><th>Aksi</th></tr></thead><tbody>{page.rows.map((brand) => (
        <tr key={brand.id}><td><form id={`brand-${brand.id}`} action={updateBrand} className="inline-edit-form"><input name="id" type="hidden" value={brand.id} /><input name="name" defaultValue={brand.name} required /></form></td><td><input name="is_active" form={`brand-${brand.id}`} type="checkbox" defaultChecked={brand.is_active} /></td><td><div className="row-actions"><MasterSubmitButton form={`brand-${brand.id}`} label="Edit" pendingLabel="Menyimpan..." /><form action={deleteBrand}><input name="id" type="hidden" value={brand.id} /><MasterSubmitButton label="Hapus" pendingLabel="Menghapus..." variant="danger" /></form></div></td></tr>
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
      <form className="panel form master-add-form" action={createProductVendor}><h2>Tambah Mapping Vendor</h2><div className="filter-grid"><SearchableSelect label="Barang" name="product_id" options={productRows.map((product) => ({ label: productDisplayName(product), value: product.id }))} /><SearchableSelect label="Vendor" name="vendor_id" options={vendorRows.map((vendor) => ({ label: vendor.name, value: vendor.id }))} /><label className="checkbox-line"><input name="is_default" type="checkbox" />Default vendor</label><MasterSubmitButton label="Tambah Mapping" pendingLabel="Menambah..." variant="primary" /></div></form>
      <section className="panel"><MasterFilter active={active} pageSize={pageSize} q={q} roleFilter={roleFilter} section="mapping-vendor" storeFilter={storeFilter} storeRows={storeRows} /><div className="table-wrap"><table><thead><tr><th>Barang</th><th>Vendor</th><th>Default</th><th>Aksi</th></tr></thead><tbody>{page.rows.map((mapping) => (
        <tr key={mapping.id}><td><form id={`mapping-${mapping.id}`} action={updateProductVendor} className="inline-edit-form"><input name="id" type="hidden" value={mapping.id} /><select name="product_id" defaultValue={mapping.product_id}>{productRows.map((product) => <option key={product.id} value={product.id}>{productDisplayName(product)}</option>)}</select></form></td><td><select name="vendor_id" form={`mapping-${mapping.id}`} defaultValue={mapping.vendor_id}>{vendorRows.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></td><td><input name="is_default" form={`mapping-${mapping.id}`} type="checkbox" defaultChecked={mapping.is_default} /></td><td><div className="row-actions"><MasterSubmitButton form={`mapping-${mapping.id}`} label="Edit" pendingLabel="Menyimpan..." /><form action={deleteProductVendor}><input name="id" type="hidden" value={mapping.id} /><MasterSubmitButton label="Hapus" pendingLabel="Menghapus..." variant="danger" /></form></div></td></tr>
      ))}</tbody></table></div><Pagination currentPage={page.currentPage} params={baseParams} totalPages={page.totalPages} /></section>
    </>
  );
}

function renderAliases({
  active,
  aliasRows,
  baseParams,
  currentPage,
  pageSize,
  productRows,
  q,
  roleFilter,
  storeFilter,
  storeRows,
  vendorRows,
}: {
  active: string;
  aliasRows: ProductVendorAliasRow[];
  baseParams: URLSearchParams;
  currentPage: number;
  pageSize: number;
  productRows: Product[];
  q: string;
  roleFilter: string;
  storeFilter: string;
  storeRows: Store[];
  vendorRows: Vendor[];
}) {
  const filtered = filterActive(aliasRows, active).filter((alias) => {
    const text = [
      alias.alias_name,
      alias.normalized_alias_name,
      alias.products ? productDisplayName(alias.products) : "",
      alias.vendors?.name ?? "",
      alias.notes ?? "",
    ].join(" ").toLowerCase();
    return !q || text.includes(q);
  });
  const page = paginate(filtered, currentPage, pageSize);

  return (
    <>
      <form className="panel form master-add-form" action={createProductVendorAlias}>
        <h2>Tambah Alias Vendor</h2>
        <p className="muted">Isi nama barang persis seperti yang muncul di struk vendor, lalu hubungkan ke master barang internal.</p>
        <div className="filter-grid">
          <div className="field"><label>Nama di Struk Vendor</label><input name="alias_name" required placeholder="Contoh: SOS JMB SAM" /></div>
          <SearchableSelect label="Barang Internal" name="product_id" options={productRows.map((product) => ({ label: productDisplayName(product), value: product.id }))} />
          <SearchableSelect label="Vendor" name="vendor_id" options={vendorRows.map((vendor) => ({ label: vendor.name, value: vendor.id }))} />
          <div className="field"><label>Catatan</label><input name="notes" placeholder="Opsional" /></div>
          <MasterSubmitButton label="Tambah Alias" pendingLabel="Menambah..." variant="primary" />
        </div>
      </form>
      <section className="panel">
        <MasterFilter active={active} pageSize={pageSize} q={q} roleFilter={roleFilter} section="alias-vendor" storeFilter={storeFilter} storeRows={storeRows} />
        <div className="table-wrap"><table><thead><tr><th>Alias Struk</th><th>Barang Internal</th><th>Vendor</th><th>Normalized</th><th>Aktif</th><th>Catatan</th><th>Aksi</th></tr></thead><tbody>
          {page.rows.map((alias) => (
            <tr key={alias.id}>
              <td><form id={`alias-${alias.id}`} action={updateProductVendorAlias} className="inline-edit-form"><input name="id" type="hidden" value={alias.id} /><input name="alias_name" defaultValue={alias.alias_name} required /></form></td>
              <td><select name="product_id" form={`alias-${alias.id}`} defaultValue={alias.product_id}>{productRows.map((product) => <option key={product.id} value={product.id}>{productDisplayName(product)}</option>)}</select></td>
              <td><select name="vendor_id" form={`alias-${alias.id}`} defaultValue={alias.vendor_id}>{vendorRows.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></td>
              <td>{alias.normalized_alias_name}</td>
              <td><input name="is_active" form={`alias-${alias.id}`} type="checkbox" defaultChecked={alias.is_active} /></td>
              <td><input name="notes" form={`alias-${alias.id}`} defaultValue={alias.notes ?? ""} /></td>
              <td><div className="row-actions"><MasterSubmitButton form={`alias-${alias.id}`} label="Edit" pendingLabel="Menyimpan..." /><form action={deleteProductVendorAlias}><input name="id" type="hidden" value={alias.id} /><MasterSubmitButton label="Hapus" pendingLabel="Menghapus..." variant="danger" /></form></div></td>
            </tr>
          ))}
        </tbody></table></div>
        <Pagination currentPage={page.currentPage} params={baseParams} totalPages={page.totalPages} />
      </section>
    </>
  );
}

function renderVendorPrices({
  baseParams,
  currentPage,
  pageSize,
  priceHistoryRows,
  priceRows,
  productRows,
  q,
  roleFilter,
  storeFilter,
  storeRows,
  vendorRows,
}: {
  baseParams: URLSearchParams;
  currentPage: number;
  pageSize: number;
  priceHistoryRows: ProductPriceHistoryRow[];
  priceRows: ProductVendorPriceRow[];
  productRows: Product[];
  q: string;
  roleFilter: string;
  storeFilter: string;
  storeRows: Store[];
  vendorRows: Vendor[];
}) {
  const filtered = priceRows.filter((row) => {
    const text = [row.products ? productDisplayName(row.products) : "", row.vendors?.name ?? "", row.current_price].join(" ").toLowerCase();
    return !q || text.includes(q);
  });
  const page = paginate(filtered, currentPage, pageSize);

  return (
    <>
      <form className="panel form master-add-form" action={updateProductVendorPrice}>
        <h2>Update Harga Vendor</h2>
        <p className="muted">Set harga terbaru untuk barang-vendor. Jika berubah, sistem otomatis mencatat history perubahan harga.</p>
        <div className="filter-grid">
          <SearchableSelect label="Barang" name="product_id" options={productRows.map((product) => ({ label: productDisplayName(product), value: product.id }))} />
          <SearchableSelect label="Vendor" name="vendor_id" options={vendorRows.map((vendor) => ({ label: vendor.name, value: vendor.id }))} />
          <div className="field"><label>Harga Terbaru</label><input min="0" name="current_price" required step="1" type="number" /></div>
          <MasterSubmitButton label="Update Harga" pendingLabel="Menyimpan..." variant="primary" />
        </div>
      </form>

      <section className="panel">
        <h2>Harga Aktif</h2>
        <MasterFilter active="all" pageSize={pageSize} q={q} roleFilter={roleFilter} section="harga-vendor" storeFilter={storeFilter} storeRows={storeRows} />
        <div className="table-wrap"><table><thead><tr><th>Barang</th><th>Vendor</th><th>Harga Aktif</th><th>Source</th><th>Update Terakhir</th></tr></thead><tbody>
          {page.rows.map((row) => (
            <tr key={row.id}>
              <td>{row.products ? productDisplayName(row.products) : "-"}</td>
              <td>{row.vendors?.name ?? "-"}</td>
              <td>{formatRupiah(Number(row.current_price))}</td>
              <td>{row.last_source ?? "-"}</td>
              <td>{row.updated_at}</td>
            </tr>
          ))}
          {page.rows.length === 0 ? <tr><td colSpan={5}>Belum ada harga vendor.</td></tr> : null}
        </tbody></table></div>
        <Pagination currentPage={page.currentPage} params={baseParams} totalPages={page.totalPages} />
      </section>

      <section className="panel">
        <h2>History Perubahan Harga</h2>
        <div className="table-wrap"><table><thead><tr><th>Tanggal</th><th>Barang</th><th>Vendor</th><th>Harga Lama</th><th>Harga Baru</th><th>Selisih</th><th>%</th><th>Source</th></tr></thead><tbody>
          {priceHistoryRows.map((row) => (
            <tr key={row.id}>
              <td>{row.changed_at}</td>
              <td>{row.products ? productDisplayName(row.products) : "-"}</td>
              <td>{row.vendors?.name ?? "-"}</td>
              <td>{row.old_price == null ? "-" : formatRupiah(Number(row.old_price))}</td>
              <td>{formatRupiah(Number(row.new_price))}</td>
              <td>{formatRupiah(Number(row.price_diff))}</td>
              <td>{row.price_diff_percent == null ? "-" : `${Number(row.price_diff_percent).toFixed(2)}%`}</td>
              <td>{row.source ?? "-"}</td>
            </tr>
          ))}
          {priceHistoryRows.length === 0 ? <tr><td colSpan={8}>Belum ada history perubahan harga.</td></tr> : null}
        </tbody></table></div>
      </section>
    </>
  );
}

function renderUsers({ active, baseParams, currentPage, menuAccessRows, pageSize, profileRows, q, roleFilter, storeFilter, storeRows }: { active: string; baseParams: URLSearchParams; currentPage: number; menuAccessRows: ProfileMenuAccess[]; pageSize: number; profileRows: Profile[]; q: string; roleFilter: string; storeFilter: string; storeRows: Store[] }) {
  const filtered = profileRows.filter((profile) => {
    const text = [profile.full_name, profile.email ?? "", profile.role, profile.id, profile.stores?.name ?? profile.store_name ?? ""].join(" ").toLowerCase();
    const matchesSearch = !q || text.includes(q);
    const matchesRole = roleFilter === "all" || profile.role === roleFilter;
    const matchesStore = storeFilter === "all" || profile.store_id === storeFilter;
    return matchesSearch && matchesRole && matchesStore;
  });
  const page = paginate(filtered, currentPage, pageSize);
  const defaultNewUserMenuKeys = new Set(defaultMenuKeysForRole("staff"));
  return (
    <>
      <form className="panel form master-add-form" action={upsertProfile}><h2>Tambah User</h2><p className="muted">Buat email/password user dulu di Supabase Authentication, lalu paste User UID di sini.</p><div className="filter-grid"><div className="field"><label>User UID</label><input name="id" required /></div><div className="field"><label>Email</label><input name="email" type="email" required /></div><div className="field"><label>Nama</label><input name="full_name" required /></div><div className="field"><label>Role</label><select name="role" defaultValue="staff"><option value="admin">admin</option><option value="staff">staff</option><option value="vendor">vendor</option></select></div><div className="field"><label>Store</label><select name="store_id"><option value="">Tidak ada</option>{storeRows.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></div><MasterSubmitButton label="Tambah User" pendingLabel="Menambah..." variant="primary" /></div><h3>Akses Menu</h3><MenuAccessFields checkedKeys={defaultNewUserMenuKeys} /></form>
      <section className="panel"><MasterFilter active={active} pageSize={pageSize} q={q} roleFilter={roleFilter} section="user" storeFilter={storeFilter} storeRows={storeRows} /><form action={resetAllProfilePasswords} className="table-toolbar"><MasterSubmitButton label="Reset Password Semua User" pendingLabel="Mereset..." /></form><div className="table-wrap"><table><thead><tr><th>Nama</th><th>Email</th><th>Role</th><th>Store</th><th>Akses Menu</th><th>User ID</th><th>Aksi</th></tr></thead><tbody>{page.rows.map((row) => {
        const formId = `profile-${row.id}`;
        const checkedKeys = menuKeysForProfileAccess(row.id, row.role, menuAccessRows);
        return (
        <tr key={row.id}><td><form id={formId} action={upsertProfile} className="inline-edit-form"><input name="id" type="hidden" value={row.id} /><input name="full_name" defaultValue={row.full_name} required /></form></td><td><input name="email" form={formId} defaultValue={row.email ?? ""} type="email" /></td><td><select name="role" form={formId} defaultValue={row.role}><option value="admin">admin</option><option value="staff">staff</option><option value="vendor">vendor</option></select></td><td><select name="store_id" form={formId} defaultValue={row.store_id ?? ""}><option value="">Tidak ada</option>{storeRows.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></td><td><form action={updateProfileMenuAccess} className="menu-access-form"><input name="profile_id" type="hidden" value={row.id} /><MenuAccessFields checkedKeys={checkedKeys} /><MasterSubmitButton label="Simpan Akses" pendingLabel="Menyimpan..." /></form></td><td>{row.id}</td><td><div className="row-actions"><MasterSubmitButton form={formId} label="Edit" pendingLabel="Menyimpan..." /><form action={resetProfilePassword}><input name="email" type="hidden" value={row.email ?? ""} /><MasterSubmitButton disabled={!row.email} label="Reset Password" pendingLabel="Mereset..." title="Reset password" /></form><form action={deleteProfile}><input name="id" type="hidden" value={row.id} /><MasterSubmitButton label="Hapus" pendingLabel="Menghapus..." variant="danger" /></form></div></td></tr>
      );})}</tbody></table></div><Pagination currentPage={page.currentPage} params={baseParams} totalPages={page.totalPages} /></section>
    </>
  );
}
