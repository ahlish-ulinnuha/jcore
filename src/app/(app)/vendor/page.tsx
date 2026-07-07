import { redirect } from "next/navigation";
import { productDisplayName } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Profile, PurchaseRequestItem, Vendor, VendorReceipt } from "@/lib/types";
import { VendorPortal } from "./VendorPortal";

type SearchParams = Promise<{ batch?: string; date?: string }>;

type VendorRequestItem = PurchaseRequestItem & {
  purchase_requests?: {
    request_no?: string;
    request_date?: string;
    batch_no?: number;
    store_name?: string;
    status?: string;
  } | null;
};

export type VendorBarangRow = {
  batchNo: number;
  requestNo: string;
  storeName: string;
  qty: number;
  unit: string;
};

export type VendorBarangGroup = {
  productId: string;
  displayName: string;
  rows: VendorBarangRow[];
};

export type VendorRequestGroup = {
  requestId: string;
  requestNo: string;
  batchNo: number;
  storeName: string;
};

function todayJakarta() {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Jakarta",
    year: "numeric",
  }).format(new Date());
}

function groupByBarang(items: VendorRequestItem[]): VendorBarangGroup[] {
  const groups = new Map<string, VendorBarangGroup>();
  for (const item of items) {
    const key = item.product_id;
    if (!groups.has(key)) {
      groups.set(key, {
        displayName: productDisplayName(item.products),
        productId: key,
        rows: [],
      });
    }
    groups.get(key)!.rows.push({
      batchNo: item.purchase_requests?.batch_no ?? 0,
      qty: item.qty,
      requestNo: item.purchase_requests?.request_no ?? "-",
      storeName: item.purchase_requests?.store_name ?? "-",
      unit: item.unit,
    });
  }
  return Array.from(groups.values()).sort((a, b) => a.displayName.localeCompare(b.displayName));
}

function groupByRequest(items: VendorRequestItem[]): VendorRequestGroup[] {
  const groups = new Map<string, VendorRequestGroup>();
  for (const item of items) {
    const key = item.request_id;
    if (!groups.has(key)) {
      groups.set(key, {
        batchNo: item.purchase_requests?.batch_no ?? 0,
        requestId: key,
        requestNo: item.purchase_requests?.request_no ?? "-",
        storeName: item.purchase_requests?.store_name ?? "-",
      });
    }
  }
  return Array.from(groups.values()).sort((a, b) => b.batchNo - a.batchNo);
}

export default async function VendorPage({ searchParams }: { searchParams: SearchParams }) {
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

  const { data: vendor } = await supabase.from("vendors").select("*").eq("id", vendorUser.vendor_id).single<Vendor>();

  const params = await searchParams;
  const requestDate = params.date ?? todayJakarta();
  const selectedBatch = params.batch ?? "all";

  const { data: items } = await supabase
    .from("purchase_request_items")
    .select("*, products(*, brands(*)), vendors(*), purchase_requests!inner(request_no, request_date, batch_no, store_name, status)")
    .eq("vendor_id", vendorUser.vendor_id)
    .eq("purchase_requests.status", "submitted")
    .eq("purchase_requests.request_date", requestDate)
    .order("created_at", { ascending: false })
    .returns<VendorRequestItem[]>();

  const allRows = items ?? [];
  const batchOptions = Array.from(new Set(allRows.map((item) => item.purchase_requests?.batch_no ?? 0))).sort((a, b) => b - a);
  const filteredRows = selectedBatch === "all" ? allRows : allRows.filter((item) => String(item.purchase_requests?.batch_no ?? "") === selectedBatch);
  const barangGroups = groupByBarang(filteredRows);
  const requestGroups = groupByRequest(filteredRows);

  const { data: receipts } = await supabase
    .from("vendor_receipts")
    .select("*")
    .eq("vendor_id", vendorUser.vendor_id)
    .eq("request_date", requestDate)
    .order("created_at", { ascending: false })
    .returns<VendorReceipt[]>();

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Vendor portal</p>
          <h1>Request {vendor?.name ?? "Vendor"}</h1>
        </div>
      </div>

      <section className="panel" style={{ marginBottom: 16 }}>
        <form className="filter-grid">
          <div className="field">
            <label>Tanggal</label>
            <input defaultValue={requestDate} name="date" type="date" />
          </div>
          <div className="field">
            <label>Batch</label>
            <select defaultValue={selectedBatch} name="batch">
              <option value="all">Semua Batch</option>
              {batchOptions.map((batch) => (
                <option key={batch} value={batch}>
                  Batch {batch}
                </option>
              ))}
            </select>
          </div>
          <button className="button primary" type="submit">
            Filter
          </button>
        </form>
      </section>

      <VendorPortal
        barangGroups={barangGroups}
        receipts={receipts ?? []}
        requestDate={requestDate}
        requestGroups={requestGroups}
        vendorId={vendorUser.vendor_id}
      />
    </>
  );
}
