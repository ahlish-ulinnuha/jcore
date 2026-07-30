import Link from "next/link";
import { redirect } from "next/navigation";
import { allowedMenuKeysForRole, hasMenuAccess } from "@/lib/menu-access";
import { createClient } from "@/lib/supabase/server";
import { productDisplayName } from "@/lib/format";
import type { DailySpiceReport, Profile, ProfileMenuAccess, PurchaseRequest, PurchaseRequestItem, Store, VendorMessageLog } from "@/lib/types";
import { DailyReportInteractive } from "./DailyReportInteractive";

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
  vendorNotes: string[];
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

function summaryProductName(item: ItemWithRequest) {
  const name = item.products?.name?.toLowerCase() ?? "-";
  const brandName = item.products?.brands?.name?.trim().toUpperCase();
  const brand = brandName && brandName !== "NOBRAND" ? ` - ${brandName}` : "";
  return `${name}${brand}`;
}

function buildVendorMessage(vendorName: string, batchNo: string, dateLabel: string, rows: ReportRow[]) {
  const lines = rows
    .slice()
    .sort((a, b) => a.productName.localeCompare(b.productName))
    .map((row) => `- ${row.productName} / ${row.qty} ${row.unit}`.trim());
  return [`*Request ${vendorName} - Batch ${batchNo}*`, `Tanggal: ${dateLabel}`, "------------------------------", ...lines].join("\n");
}

function messageStatusLabel(status: VendorMessageLog["status"]) {
  return status === "success" ? "Terkirim" : "Gagal";
}

function messageSourceLabel(source: VendorMessageLog["source"]) {
  return source === "cron" ? "Otomatis (Cron)" : "Manual";
}

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value));
}

export default async function DailyReportPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile || profile.role === "vendor") redirect("/dashboard");

  const { data: menuAccessRows } = await supabase
    .from("profile_menu_access")
    .select("*")
    .eq("profile_id", profile.id)
    .returns<ProfileMenuAccess[]>();
  const allowedMenuKeys = allowedMenuKeysForRole(profile.role, menuAccessRows ?? []);
  const canSendVendorMessage = hasMenuAccess("send_vendor_message", allowedMenuKeys);

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

  const { data: messageLogs } = await supabase
    .from("vendor_message_logs")
    .select("*, vendors(*)")
    .eq("request_date", date)
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<VendorMessageLog[]>();

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
        vendorNotes: [],
        unit: item.unit,
        status: item.status,
      };
      acc[key].qty += Number(item.qty);
      const storeName = item.purchase_requests?.store_name?.trim();
      if (storeName && !acc[key].storeNames.includes(storeName)) {
        acc[key].storeNames.push(storeName);
      }
      const vendorNote = item.vendor_note?.trim();
      if (vendorNote && !acc[key].vendorNotes.includes(vendorNote)) {
        acc[key].vendorNotes.push(vendorNote);
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
  const interactiveBatchGroups = batchVendorGroups.map((batchGroup) => ({
    batchNo: batchGroup.batchNo,
    vendors: batchGroup.vendors.map((vendor) => ({
      rows: vendor.rows.map((row) => ({
        batchNo: row.batchNo,
        productName: row.productName,
        qty: row.qty,
        rowKey: `${row.batchNo}-${row.vendorId}-${row.productId}-${row.status}`,
        status: row.status,
        storeNames: row.storeNames,
        summaryProductName: row.summaryProductName,
        unit: row.unit,
        vendorId: row.vendorId,
        vendorName: row.vendorName,
        vendorNotes: row.vendorNotes,
      })),
      vendorId: vendor.vendorId,
      vendorMessage: buildVendorMessage(vendor.vendorName, batchGroup.batchNo, requestDateLabel, vendor.rows),
      vendorName: vendor.vendorName,
    })),
  }));
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
      </section>

      <DailyReportInteractive
        batchGroups={interactiveBatchGroups}
        canSendVendorMessage={canSendVendorMessage}
        date={date}
        includeAllStoreTotal={profile.role === "admin"}
        isAdmin={profile.role === "admin"}
        outletName={selectedStoreName}
        requestDateLabel={requestDateLabel}
        spiceRows={(spiceReports ?? []).map((report) => ({
          redSpiceStock: Number(report.red_spice_stock),
          storeName: report.store_name,
          whiteSpiceStock: Number(report.white_spice_stock),
        }))}
      />

      {reportRows.length === 0 ? (
        <section className="panel">
          <h2>Belum ada request</h2>
          <p className="muted">Tidak ada item purchase request untuk filter yang dipilih.</p>
        </section>
      ) : null}

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="page-head compact">
          <div>
            <p className="eyebrow">Riwayat</p>
            <h2>Riwayat Pengiriman Pesan Vendor</h2>
          </div>
        </div>
        <div className="table-wrap compact-mobile-wrap">
          <table className="compact-mobile-table">
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Vendor</th>
                <th>No. WhatsApp</th>
                <th>Batch</th>
                <th>Sumber</th>
                <th>Status</th>
                <th>Keterangan</th>
                <th>Pesan</th>
              </tr>
            </thead>
            <tbody>
              {(messageLogs ?? []).map((log) => (
                <tr key={log.id}>
                  <td>{formatMessageTime(log.created_at)}</td>
                  <td>{log.vendors?.name ?? "-"}</td>
                  <td>{log.phone ?? log.vendors?.phone ?? "-"}</td>
                  <td>Batch {log.batch_no}</td>
                  <td>{messageSourceLabel(log.source)}</td>
                  <td>
                    <span className={`payment-status-badge ${log.status === "success" ? "paid" : "unpaid"}`}>{messageStatusLabel(log.status)}</span>
                  </td>
                  <td>{log.error_message ?? "-"}</td>
                  <td style={{ whiteSpace: "pre-wrap", minWidth: 220 }}>{log.message}</td>
                </tr>
              ))}
              {(messageLogs ?? []).length === 0 ? (
                <tr>
                  <td colSpan={8}>Belum ada pesan yang dikirim untuk tanggal ini.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
