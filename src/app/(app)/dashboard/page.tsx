import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, PurchaseRequest } from "@/lib/types";

function todayJakarta() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDays(dateValue: string, days: number) {
  const date = new Date(`${dateValue}T00:00:00+07:00`);
  date.setDate(date.getDate() + days);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function displayDate(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}-${month}-${year}`;
}

type SearchParams = Promise<{ date_from?: string; date_to?: string }>;

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
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
  const tomorrow = addDays(today, 1);
  const params = await searchParams;
  const dateFrom = params.date_from ?? today;
  const dateTo = params.date_to ?? tomorrow;
  const staffStoreId = profile.role === "staff" ? profile.store_id : null;

  const requestCountQuery = supabase
    .from("purchase_requests")
    .select("id", { count: "exact", head: true })
    .gte("request_date", dateFrom)
    .lte("request_date", dateTo);
  const requestsQuery = supabase
    .from("purchase_requests")
    .select("*")
    .gte("request_date", dateFrom)
    .lte("request_date", dateTo)
    .order("request_date", { ascending: false })
    .order("batch_no", { ascending: false });
  const unavailableQuery = supabase
      .from("purchase_request_items")
      .select("id, purchase_requests!inner(request_date, status, store_id)", { count: "exact", head: true })
      .gte("purchase_requests.request_date", dateFrom)
      .lte("purchase_requests.request_date", dateTo)
      .eq("purchase_requests.status", "submitted")
      .in("status", ["unavailable", "partially_available"]);

  if (staffStoreId) {
    requestCountQuery.eq("store_id", staffStoreId);
    requestsQuery.eq("store_id", staffStoreId);
    unavailableQuery.eq("purchase_requests.store_id", staffStoreId);
  }

  const [{ count: requestCount }, { data: requests }, { count: unavailableCount }] = await Promise.all([
    requestCountQuery,
    requestsQuery.returns<PurchaseRequest[]>(),
    unavailableQuery,
  ]);

  const requestRows = requests ?? [];

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
        <div className="page-head compact">
          <div>
            <h2>Request</h2>
            <p className="muted">Default menampilkan request hari ini sampai besok.</p>
          </div>
        </div>
        <form className="filter-grid" style={{ marginBottom: 14 }}>
          <div className="field">
            <label>Dari tanggal</label>
            <input name="date_from" type="date" defaultValue={dateFrom} />
          </div>
          <div className="field">
            <label>Sampai tanggal</label>
            <input name="date_to" type="date" defaultValue={dateTo} />
          </div>
          <button className="button primary" type="submit">
            Tampilkan
          </button>
        </form>
        <div className="table-wrap compact-mobile-wrap">
          <table className="compact-mobile-table">
            <thead>
              <tr>
                <th>Tanggal</th>
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
                  <td>{displayDate(request.request_date)}</td>
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
                  <td colSpan={6}>Belum ada request untuk tanggal yang dipilih.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
