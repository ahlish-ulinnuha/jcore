import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { productDisplayName } from "@/lib/format";
import type { DailySpiceReport, Profile, PurchaseRequest, PurchaseRequestItem, Store } from "@/lib/types";
import { CopySummaryButton } from "./CopySummaryButton";

type ItemWithRequest = PurchaseRequestItem & {
  purchase_requests?: {
    request_date?: string;
    request_no?: string;
    batch_no?: number;
    store_id?: string | null;
    store_name?: string;
    status?: PurchaseRequest["status"];
  };
};

type ReportRow = {
  batchNo: number;
  vendorId: string;
  vendorName: string;
  productId: string;
  productName: string;
  summaryProductName: string;
  qty: number;
  storeNames: string[];
  unit: string;
  status: PurchaseRequestItem["status"];
};

function todayJakarta() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function displayDate(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}-${month}-${year}`;
}

type SearchParams = Promise<{
  batch?: string;
  date?: string;
  request_status?: string;
  status?: string;
  store?: string;
  vendor?: string;
}>;

const statusOptions = [
  { label: "Requested", value: "requested" },
  { label: "Fulfilled", value: "fulfilled" },
  { label: "Unavailable", value: "unavailable" },
];

const requestStatusOptions = [
  { label: "Submitted", value: "submitted" },
  { label: "Draft", value: "draft" },
  { label: "All Request Status", value: "all" },
];

function statusLabel(status: PurchaseRequestItem["status"]) {
  if (status === "fulfilled") return "Fulfilled";
  if (status === "unavailable") return "Unavailable";
  return status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusIcon(status: PurchaseRequestItem["status"]) {
  if (status === "fulfilled") return "✓";
  if (status === "unavailable") return "∅";
  if (status === "partially_available") return "½";
  if (status === "cancelled") return "×";
  if (status === "confirmed") return "✓";
  return "⏳";
}

function summaryProductName(item: ItemWithRequest) {
  const name = item.products?.name?.toLowerCase() ?? "-";
  const brandName = item.products?.brands?.name?.trim().toUpperCase();
  const brand = brandName && brandName !== "NOBRAND" ? ` - ${brandName}` : "";
  return `${name}${brand}`;
}

export default async function DailyReportPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile || profile.role === "vendor") redirect("/dashboard");

  const params = await searchParams;
  const date = params.date ?? todayJakarta();
  const spiceReportDate = todayJakarta();
  const selectedVendor = params.vendor ?? "all";
  const selectedStatus = params.status ?? "all";
  const selectedRequestStatus = profile.role === "admin" ? params.request_status ?? "submitted" : "submitted";
  const selectedStore = profile.role === "admin" ? params.store ?? "all" : profile.store_id ?? "all";
  const staffStoreId = profile.role === "staff" ? profile.store_id : null;

  const { data: stores } = profile.role === "admin"
    ? await supabase.from("stores").select("*").eq("is_active", true).order("name").returns<Store[]>()
    : { data: [] as Store[] };

  const itemsQuery = supabase
    .from("purchase_request_items")
    .select("*, products(*, brands(*)), vendors(*), purchase_requests!inner(request_date, request_no, batch_no, store_id, store_name, status)")
    .eq("purchase_requests.request_date", date)
    .order("vendor_id");

  if (selectedRequestStatus !== "all") {
    itemsQuery.eq("purchase_requests.status", selectedRequestStatus);
  }

  if (staffStoreId) {
    itemsQuery.eq("purchase_requests.store_id", staffStoreId);
  }

  if (profile.role === "admin" && selectedStore !== "all") {
    itemsQuery.eq("purchase_requests.store_id", selectedStore);
  }

  const { data: items } = await itemsQuery.returns<ItemWithRequest[]>();

  const spiceQuery = supabase
    .from("daily_spice_reports")
    .select("*")
    .eq("report_date", spiceReportDate);

  if (staffStoreId) {
    spiceQuery.eq("store_id", staffStoreId);
  }

  if (profile.role === "admin" && selectedStore !== "all") {
    spiceQuery.eq("store_id", selectedStore);
  }

  const { data: spiceReports } = await spiceQuery.order("store_name").returns<DailySpiceReport[]>();

  const rows = items ?? [];
  const batchNumbers = Array.from(new Set(rows.map((item) => item.purchase_requests?.batch_no ?? 0).filter(Boolean))).sort((a, b) => b - a);
  const selectedBatch = params.batch ?? "all";
  const vendorOptions = Array.from(
    new Map(rows.map((item) => [item.vendor_id, item.vendors?.name ?? "Unknown Vendor"])).entries(),
  ).sort((a, b) => a[1].localeCompare(b[1]));

  const filteredItems = rows.filter((item) => {
    const batchNo = item.purchase_requests?.batch_no ?? 0;
    const matchesBatch = selectedBatch === "all" || String(batchNo) === selectedBatch;
    const matchesVendor = selectedVendor === "all" || item.vendor_id === selectedVendor;
    const matchesStatus = selectedStatus === "all" || item.status === selectedStatus;
    return matchesBatch && matchesVendor && matchesStatus;
  });

  const reportRows = Object.values(
    filteredItems.reduce<Record<string, ReportRow>>((acc, item) => {
      const batchNo = item.purchase_requests?.batch_no ?? 0;
      const productName = productDisplayName(item.products);
      const key = [batchNo, item.vendor_id, item.product_id, item.status].join("|");
      acc[key] ??= {
        batchNo,
        vendorId: item.vendor_id,
        vendorName: item.vendors?.name ?? "Unknown Vendor",
        productId: item.product_id,
        productName,
        summaryProductName: summaryProductName(item),
        qty: 0,
        storeNames: [],
        unit: item.unit,
        status: item.status,
      };
      acc[key].qty += Number(item.qty);
      const storeName = item.purchase_requests?.store_name?.trim();
      if (storeName && !acc[key].storeNames.includes(storeName)) {
        acc[key].storeNames.push(storeName);
      }
      return acc;
    }, {}),
  ).sort((a, b) => b.batchNo - a.batchNo || a.vendorName.localeCompare(b.vendorName) || a.productName.localeCompare(b.productName));

  const groupedByBatch = reportRows.reduce<Record<string, ReportRow[]>>((acc, row) => {
    const key = String(row.batchNo);
    acc[key] ??= [];
    acc[key].push(row);
    return acc;
  }, {});
  const batchGroups = Object.entries(groupedByBatch).sort(([batchA], [batchB]) => Number(batchB) - Number(batchA));
  const batchVendorGroups = batchGroups.map(([batchNo, batchRows]) => {
    const vendors = Object.values(
      batchRows.reduce<Record<string, { vendorId: string; vendorName: string; rows: ReportRow[] }>>((acc, row) => {
        acc[row.vendorId] ??= { vendorId: row.vendorId, vendorName: row.vendorName, rows: [] };
        acc[row.vendorId].rows.push(row);
        return acc;
      }, {}),
    ).sort((a, b) => a.vendorName.localeCompare(b.vendorName));
    return { batchNo, vendors };
  });
  const requestDateLabel = displayDate(date);
  const selectedStoreName =
    profile.role === "staff"
      ? profile.store_name ?? spiceReports?.[0]?.store_name ?? rows[0]?.purchase_requests?.store_name ?? "store staff"
      : selectedStore === "all"
        ? "all store"
        : stores?.find((store) => store.id === selectedStore)?.name ?? "all store";

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Report harian</p>
          <h1>Report per batch</h1>
          <p className="muted">Default menampilkan batch terakhir. Gunakan filter untuk melihat batch, vendor, atau status tertentu.</p>
        </div>
      </div>

      <section className="panel filter-panel">
        <form className="filter-grid">
          <div className="field">
            <label>Tanggal</label>
            <input name="date" type="date" defaultValue={date} />
          </div>
          <div className="field">
            <label>Batch</label>
            <select name="batch" defaultValue={selectedBatch}>
              <option value="all">All Batch</option>
              {batchNumbers.map((batchNo) => (
                <option key={batchNo} value={batchNo}>
                  Batch {batchNo}
                </option>
              ))}
            </select>
          </div>
          {profile.role === "admin" ? (
            <div className="field">
              <label>Store</label>
              <select name="store" defaultValue={selectedStore}>
                <option value="all">All Store</option>
                {(stores ?? []).map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {profile.role === "admin" ? (
            <div className="field">
              <label>Request Status</label>
              <select name="request_status" defaultValue={selectedRequestStatus}>
                {requestStatusOptions.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="field">
            <label>Vendor</label>
            <select name="vendor" defaultValue={selectedVendor}>
              <option value="all">All Vendor</option>
              {vendorOptions.map(([vendorId, vendorName]) => (
                <option key={vendorId} value={vendorId}>
                  {vendorName}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Status</label>
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
          <Link className="button outline" href="/reports/daily">
            Reset
          </Link>
        </form>
        <div className="filter-actions">
          <CopySummaryButton
            date={date}
            includeAllStoreTotal={profile.role === "admin"}
            outletName={selectedStoreName}
            rows={reportRows.map((row) => ({
              productName: row.summaryProductName,
              qty: row.qty,
              storeNames: row.storeNames,
              unit: row.unit,
              vendorName: row.vendorName,
            }))}
            spiceRows={(spiceReports ?? []).map((report) => ({
              redSpiceStock: Number(report.red_spice_stock),
              storeName: report.store_name,
              whiteSpiceStock: Number(report.white_spice_stock),
            }))}
          />
        </div>
      </section>

      {batchVendorGroups.map((batchGroup) => (
        <section className="panel daily-report-group" key={batchGroup.batchNo}>
          <h2>
            Batch {batchGroup.batchNo} <span className="muted">- {requestDateLabel}</span>
          </h2>
          <div className="vendor-report-list">
            {batchGroup.vendors.map((vendor) => (
              <section className="vendor-report-group" key={`${batchGroup.batchNo}-${vendor.vendorId}`}>
                <h3>{vendor.vendorName}</h3>
                <div className="report-item-list">
                  {vendor.rows.map((row) => (
                    <div className="report-item-row" key={`${row.batchNo}-${row.vendorId}-${row.productId}-${row.status}`}>
                      <span className="report-item-product">{row.productName}</span>
                      <span className="report-item-qty">{row.qty}</span>
                      <span
                        aria-label={statusLabel(row.status)}
                        className={`status-icon ${row.status}`}
                        data-tooltip={statusLabel(row.status)}
                        tabIndex={0}
                      >
                        {statusIcon(row.status)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>
      ))}

      {reportRows.length === 0 ? (
        <section className="panel">
          <h2>Belum ada request</h2>
          <p className="muted">Tidak ada item purchase request untuk filter yang dipilih.</p>
        </section>
      ) : null}
    </>
  );
}
