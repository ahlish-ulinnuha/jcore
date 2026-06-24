import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ProductVendorPrice, Profile, PurchaseRequestItem, Vendor, VendorReceipt } from "@/lib/types";
import { AdminVendorPortal } from "./AdminVendorPortal";

type SearchParams = Promise<{
  date?: string;
  status?: string;
  vendor?: string;
}>;

type AdminVendorItem = PurchaseRequestItem & {
  purchase_requests?: {
    batch_no?: number;
    request_date?: string;
    request_no?: string;
    store_name?: string;
    status?: string;
  } | null;
};

const statusOptions = [
  { label: "Requested", value: "requested" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Partially Available", value: "partially_available" },
  { label: "Fulfilled", value: "fulfilled" },
  { label: "Unavailable", value: "unavailable" },
  { label: "Cancelled", value: "cancelled" },
];

function todayJakarta() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function AdminVendorPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile || profile.role !== "admin") redirect("/dashboard");

  const params = await searchParams;
  const requestDate = params.date ?? todayJakarta();
  const selectedVendor = params.vendor ?? "all";
  const selectedStatus = params.status ?? "all";

  const { data: vendors } = await supabase.from("vendors").select("*").eq("is_active", true).order("name").returns<Vendor[]>();

  const itemsQuery = supabase
    .from("purchase_request_items")
    .select("*, products(*, brands(*)), vendors(*), purchase_requests!inner(request_no, request_date, batch_no, store_name, status)")
    .eq("purchase_requests.request_date", requestDate)
    .eq("purchase_requests.status", "submitted")
    .order("vendor_id")
    .order("created_at", { ascending: false });

  if (selectedVendor !== "all") {
    itemsQuery.eq("vendor_id", selectedVendor);
  }

  if (selectedStatus !== "all") {
    itemsQuery.eq("status", selectedStatus);
  }

  const { data: items } = await itemsQuery.returns<AdminVendorItem[]>();
  const rows = items ?? [];
  const vendorIds = Array.from(new Set(rows.map((item) => item.vendor_id)));

  const { data: receipts } = vendorIds.length
    ? await supabase
        .from("vendor_receipts")
        .select("*, vendors(*)")
        .eq("request_date", requestDate)
        .in("vendor_id", vendorIds)
        .order("created_at", { ascending: false })
        .returns<VendorReceipt[]>()
    : { data: [] as VendorReceipt[] };

  const { data: priceRows } = vendorIds.length
    ? await supabase.from("product_vendor_prices").select("*").in("vendor_id", vendorIds).returns<ProductVendorPrice[]>()
    : { data: [] as ProductVendorPrice[] };

  const groups = Object.values(
    rows.reduce<Record<string, { items: AdminVendorItem[]; receipts: VendorReceipt[]; vendorId: string; vendorName: string }>>((acc, item) => {
      acc[item.vendor_id] ??= {
        items: [],
        receipts: (receipts ?? []).filter((receipt) => receipt.vendor_id === item.vendor_id),
        vendorId: item.vendor_id,
        vendorName: item.vendors?.name ?? "Unknown Vendor",
      };
      acc[item.vendor_id].items.push(item);
      return acc;
    }, {}),
  ).sort((a, b) => a.vendorName.localeCompare(b.vendorName));

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Admin vendor</p>
          <h1>Struk dan harga pembelian</h1>
          <p className="muted">Filter request, upload struk per vendor, lalu isi qty dan harga aktual dari struk.</p>
        </div>
      </div>

      <section className="panel filter-panel">
        <form className="filter-grid">
          <div className="field">
            <label>Tanggal Request</label>
            <input name="date" type="date" defaultValue={requestDate} />
          </div>
          <div className="field">
            <label>Vendor</label>
            <select name="vendor" defaultValue={selectedVendor}>
              <option value="all">All Vendor</option>
              {(vendors ?? []).map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Status Item</label>
            <select name="status" defaultValue={selectedStatus}>
              <option value="all">All Status</option>
              {statusOptions.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>
          <button className="button primary" type="submit">
            Tampilkan
          </button>
          <Link className="button outline" href="/admin/vendor">
            Reset
          </Link>
        </form>
      </section>

      <AdminVendorPortal groups={groups} priceRows={priceRows ?? []} requestDate={requestDate} />
    </>
  );
}
