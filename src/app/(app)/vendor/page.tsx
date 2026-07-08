import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, PurchaseRequestItem, Vendor, VendorReceipt } from "@/lib/types";
import { VendorPortal } from "./VendorPortal";

type SearchParams = Promise<{ batch?: string; date?: string }>;

type VendorRequestItem = PurchaseRequestItem & {
  purchase_requests?: {
    request_no?: string;
    request_date?: string;
    batch_no?: number;
    store_id?: string | null;
    store_name?: string;
    status?: string;
  } | null;
};

export type VendorBatchGroup = {
  batchNo: number;
  items: VendorRequestItem[];
  requestNos: string[];
  storeNames: string[];
};

function todayJakarta() {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Jakarta",
    year: "numeric",
  }).format(new Date());
}

function groupByBatch(items: VendorRequestItem[]): VendorBatchGroup[] {
  const groups = new Map<number, VendorBatchGroup>();
  for (const item of items) {
    const batchNo = item.purchase_requests?.batch_no ?? 0;
    if (!groups.has(batchNo)) {
      groups.set(batchNo, {
        batchNo,
        items: [],
        requestNos: [],
        storeNames: [],
      });
    }
    const group = groups.get(batchNo)!;
    group.items.push(item);
    const requestNo = item.purchase_requests?.request_no ?? "-";
    if (!group.requestNos.includes(requestNo)) group.requestNos.push(requestNo);
    const storeName = item.purchase_requests?.store_name ?? "-";
    if (!group.storeNames.includes(storeName)) group.storeNames.push(storeName);
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
    .select("*, products(*, brands(*)), vendors(*), purchase_requests!inner(request_no, request_date, batch_no, store_id, store_name, status)")
    .eq("vendor_id", vendorUser.vendor_id)
    .eq("purchase_requests.status", "submitted")
    .eq("purchase_requests.request_date", requestDate)
    .order("created_at", { ascending: false })
    .returns<VendorRequestItem[]>();

  const allRows = items ?? [];
  const batchOptions = Array.from(new Set(allRows.map((item) => item.purchase_requests?.batch_no ?? 0))).sort((a, b) => b - a);
  const filteredRows = selectedBatch === "all" ? allRows : allRows.filter((item) => String(item.purchase_requests?.batch_no ?? "") === selectedBatch);
  const batchGroups = groupByBatch(filteredRows);

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

      <VendorPortal batchGroups={batchGroups} receipts={receipts ?? []} requestDate={requestDate} vendorId={vendorUser.vendor_id} />
    </>
  );
}
