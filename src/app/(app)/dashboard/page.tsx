import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { productDisplayName } from "@/lib/format";
import type { Profile, PurchaseRequest, PurchaseRequestItem } from "@/lib/types";

type ItemWithRequest = PurchaseRequestItem & {
  purchase_requests?: {
    batch_no?: number;
    request_date?: string;
    request_no?: string;
    status?: PurchaseRequest["status"];
    store_id?: string | null;
    store_name?: string;
  };
};

type DashboardReportRow = {
  batchNo: number;
  productId: string;
  productName: string;
  qty: number;
  status: PurchaseRequestItem["status"];
  vendorId: string;
  vendorName: string;
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

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile) redirect("/login");

  if (profile.role === "vendor") {
    redirect("/vendor");
  }

  const today = todayJakarta();
  const staffStoreId = profile.role === "staff" ? profile.store_id : null;

  const requestCountQuery = supabase.from("purchase_requests").select("id", { count: "exact", head: true }).eq("request_date", today).eq("status", "submitted");
  const requestsQuery = supabase.from("purchase_requests").select("*").eq("request_date", today).order("created_at", { ascending: false });
  const itemsQuery = supabase
      .from("purchase_request_items")
      .select("*, products(*, brands(*)), vendors(*), purchase_requests!inner(request_date, request_no, batch_no, status, store_id, store_name)")
      .eq("purchase_requests.request_date", today)
      .eq("purchase_requests.status", "submitted")
      .order("created_at", { ascending: false });
  const unavailableQuery = supabase
      .from("purchase_request_items")
      .select("id, purchase_requests!inner(request_date, status, store_id)", { count: "exact", head: true })
      .eq("purchase_requests.request_date", today)
      .eq("purchase_requests.status", "submitted")
      .in("status", ["unavailable", "partially_available"]);

  if (staffStoreId) {
    requestCountQuery.eq("store_id", staffStoreId);
    requestsQuery.eq("store_id", staffStoreId);
    itemsQuery.eq("purchase_requests.store_id", staffStoreId);
    unavailableQuery.eq("purchase_requests.store_id", staffStoreId);
  }

  const [{ count: requestCount }, { data: requests }, { data: items }, { count: unavailableCount }] = await Promise.all([
    requestCountQuery,
    requestsQuery.returns<PurchaseRequest[]>(),
    itemsQuery.returns<ItemWithRequest[]>(),
    unavailableQuery,
  ]);

  const itemRows = items ?? [];
  const requestRows = requests ?? [];
  const vendorCount = new Set(itemRows.map((item) => item.vendor_id)).size;
  const requestByBatch = requestRows.reduce<Record<string, PurchaseRequest>>((acc, request) => {
    acc[String(request.batch_no)] ??= request;
    return acc;
  }, {});
  const reportRows = Object.values(
    itemRows.reduce<Record<string, DashboardReportRow>>((acc, item) => {
      const batchNo = item.purchase_requests?.batch_no ?? 0;
      const vendorId = item.vendor_id ?? "unknown";
      const productId = item.product_id ?? "unknown";
      const key = [batchNo, vendorId, productId, item.status].join("|");
      acc[key] ??= {
        batchNo,
        productId,
        productName: productDisplayName(item.products),
        qty: 0,
        status: item.status,
        vendorId,
        vendorName: item.vendors?.name ?? "Tanpa vendor",
      };
      acc[key].qty += Number(item.qty);
      return acc;
    }, {}),
  ).sort((a, b) => b.batchNo - a.batchNo || a.vendorName.localeCompare(b.vendorName) || a.productName.localeCompare(b.productName));
  const batchVendorGroups = Object.entries(
    reportRows.reduce<Record<string, DashboardReportRow[]>>((acc, row) => {
      acc[String(row.batchNo)] ??= [];
      acc[String(row.batchNo)].push(row);
      return acc;
    }, {}),
  )
    .sort(([batchA], [batchB]) => Number(batchB) - Number(batchA))
    .map(([batchNo, batchRows]) => {
      const vendors = Object.values(
        batchRows.reduce<Record<string, { vendorId: string; vendorName: string; rows: DashboardReportRow[] }>>((acc, row) => {
          acc[row.vendorId] ??= { vendorId: row.vendorId, vendorName: row.vendorName, rows: [] };
          acc[row.vendorId].rows.push(row);
          return acc;
        }, {}),
      ).sort((a, b) => a.vendorName.localeCompare(b.vendorName));
      return { batchNo, vendors };
    });
  const groupedItems = Object.values(
    itemRows.reduce<Record<string, { vendorId: string; vendorName: string; rows: PurchaseRequestItem[] }>>((acc, item) => {
      const vendorId = item.vendor_id ?? "unknown";
      acc[vendorId] ??= { vendorId, vendorName: item.vendors?.name ?? "Tanpa vendor", rows: [] };
      acc[vendorId].rows.push(item);
      return acc;
    }, {}),
  ).sort((a, b) => a.vendorName.localeCompare(b.vendorName));

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">{today}</p>
          <h1>
            Welcome Back, <span className="muted">{profile.full_name}</span>
          </h1>
          <p className="muted">Ringkasan purchase request yang dibuat staff pertoko.</p>
        </div>
        <Link className="button primary" href="/requests/new">
          Request Baru
        </Link>
      </div>

      <section className="grid cols-3">
        <div className="panel stat stat-primary">
          <span className="muted">Jumlah request</span>
          <strong>{requestCount ?? 0}</strong>
        </div>        
        <div className="panel stat">
          <span className="muted">Perlu perhatian</span>
          <strong>{unavailableCount ?? 0}</strong>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 18 }}>
        <h2>Detail request per batch</h2>
        {batchVendorGroups.length ? (
          batchVendorGroups.map((batchGroup) => {
            const request = requestByBatch[batchGroup.batchNo];
            return (
              <section className="daily-report-group dashboard-batch-group" key={batchGroup.batchNo}>
                <div className="batch-title-row">
                  <h3>
                    Batch {batchGroup.batchNo} <span className="muted">- {displayDate(today)}</span>
                  </h3>
                  {request ? (
                    <Link className="button outline" href={`/requests/${request.id}/edit`}>
                      Lihat
                    </Link>
                  ) : null}
                </div>
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
            );
          })
        ) : (
          <p className="muted">Belum ada request hari ini.</p>
        )}
      </section>

      <section className="panel" style={{ marginTop: 18 }}>
        <h2>Item terbaru</h2>
        {groupedItems.length ? (
          <div className="vendor-report-list dashboard-vendor-list">
            {groupedItems.map((vendor) => (
              <section className="vendor-report-group dashboard-vendor-group" key={vendor.vendorId}>
                <h3>{vendor.vendorName}</h3>
                <div className="report-item-list">
                  {vendor.rows.map((item) => (
                    <div className="report-item-row dashboard-item-row" key={item.id}>
                      <span className="report-item-product">{productDisplayName(item.products)}</span>
                      <span className="report-item-qty">{item.qty}</span>
                      <span
                        aria-label={statusLabel(item.status)}
                        className={`status-icon ${item.status}`}
                        data-tooltip={statusLabel(item.status)}
                        tabIndex={0}
                      >
                        {statusIcon(item.status)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <p className="muted">Belum ada request hari ini.</p>
        )}
      </section>
    </>
  );
}
