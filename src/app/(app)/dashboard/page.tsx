import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { productDisplayName } from "@/lib/format";
import type { Profile, PurchaseRequest, PurchaseRequestItem } from "@/lib/types";

function todayJakarta() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
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
      .select("*, products(*, brands(*)), vendors(*), purchase_requests!inner(request_date, status, store_id)")
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
    itemsQuery.returns<PurchaseRequestItem[]>(),
    unavailableQuery,
  ]);

  const itemRows = items ?? [];
  const requestRows = requests ?? [];
  const vendorCount = new Set(itemRows.map((item) => item.vendor_id)).size;

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
        <h2>Request hari ini</h2>
        <div className="table-wrap compact-mobile-wrap">
          <table className="compact-mobile-table">
            <thead>
              <tr>
                <th>No Request</th>
                <th>Store</th>
                <th>Batch</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {requestRows.map((request) => (
                <tr key={request.id}>
                  <td>{request.request_no}</td>
                  <td>{request.store_name}</td>
                  <td>Batch {request.batch_no}</td>
                  <td>
                    <span className={`badge ${request.status}`}>{request.status}</span>
                  </td>
                  <td>
                    <Link className="button" href={`/requests/${request.id}/edit`}>
                      {request.status === "draft" ? "Edit Draft" : "Lihat"}
                    </Link>
                  </td>
                </tr>
              ))}
              {requestRows.length === 0 ? (
                <tr>
                  <td colSpan={5}>Belum ada request hari ini.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 18 }}>
        <h2>Item terbaru</h2>
        <div className="table-wrap compact-mobile-wrap">
          <table className="compact-mobile-table">
            <thead>
              <tr>
                <th>Barang</th>
                <th>Vendor</th>
                <th>Qty</th>
                <th>Status</th>
                <th>Catatan vendor</th>
              </tr>
            </thead>
            <tbody>
              {itemRows.map((item) => (
                <tr key={item.id}>
                  <td>
                    {productDisplayName(item.products)}
                  </td>
                  <td>{item.vendors?.name ?? "-"}</td>
                  <td>
                    {item.qty} {item.unit}
                  </td>
                  <td>
                    <span className={`badge ${item.status}`}>{item.status.replaceAll("_", " ")}</span>
                  </td>
                  <td>{item.vendor_note ?? "-"}</td>
                </tr>
              ))}
              {itemRows.length === 0 ? (
                <tr>
                  <td colSpan={5}>Belum ada request hari ini.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
