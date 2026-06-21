import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { DailySpiceReport, Profile, Store } from "@/lib/types";
import { deleteDailySpiceReport, saveDailySpiceReport } from "./actions";

function todayJakarta() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

type SearchParams = Promise<{
  date?: string;
  error?: string;
  deleted?: string;
  history_date?: string;
  history_store?: string;
  page?: string;
  page_size?: string;
  saved?: string;
  store?: string;
}>;

export default async function DailySpiceReportPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*, stores(*)").eq("id", user.id).single<Profile>();
  if (!profile || profile.role === "vendor") redirect("/dashboard");

  const params = await searchParams;
  const reportDate = params.date ?? todayJakarta();
  const historyDate = params.history_date ?? "";
  const historyStore = profile.role === "admin" ? params.history_store ?? "all" : profile.store_id ?? "all";
  const currentPage = Math.max(1, Number(params.page ?? 1) || 1);
  const pageSizeOptions = [10, 20, 50, 100];
  const requestedPageSize = Number(params.page_size ?? 10);
  const pageSize = pageSizeOptions.includes(requestedPageSize) ? requestedPageSize : 10;
  const rangeFrom = (currentPage - 1) * pageSize;
  const rangeTo = rangeFrom + pageSize - 1;
  const { data: stores } = profile.role === "admin"
    ? await supabase.from("stores").select("*").eq("is_active", true).order("name").returns<Store[]>()
    : { data: [] as Store[] };
  const selectedStoreId = profile.role === "admin" ? params.store ?? stores?.[0]?.id ?? "" : profile.store_id ?? "";

  const { data: report } = selectedStoreId
    ? await supabase
        .from("daily_spice_reports")
        .select("*")
        .eq("report_date", reportDate)
        .eq("store_id", selectedStoreId)
        .maybeSingle<DailySpiceReport>()
    : { data: null };

  const historyQuery = supabase
    .from("daily_spice_reports")
    .select("*", { count: "exact" })
    .order("report_date", { ascending: false })
    .order("store_name")
    .range(rangeFrom, rangeTo);

  if (profile.role === "staff" && profile.store_id) {
    historyQuery.eq("store_id", profile.store_id);
  }

  if (profile.role === "admin" && historyStore !== "all") {
    historyQuery.eq("store_id", historyStore);
  }

  if (historyDate) {
    historyQuery.eq("report_date", historyDate);
  }

  const { data: historyReports, count: historyCount } = await historyQuery.returns<DailySpiceReport[]>();
  const totalPages = Math.max(1, Math.ceil((historyCount ?? 0) / pageSize));
  const historyParams = new URLSearchParams();
  historyParams.set("date", reportDate);
  historyParams.set("store", selectedStoreId);
  if (historyDate) historyParams.set("history_date", historyDate);
  if (historyStore !== "all") historyParams.set("history_store", historyStore);
  historyParams.set("page_size", String(pageSize));
  const previousParams = new URLSearchParams(historyParams);
  previousParams.set("page", String(Math.max(1, currentPage - 1)));
  const nextParams = new URLSearchParams(historyParams);
  nextParams.set("page", String(Math.min(totalPages, currentPage + 1)));
  const currentParams = new URLSearchParams(historyParams);
  currentParams.set("page", String(currentPage));
  const currentPath = `/reports/spices?${currentParams}`;
  const resetHistoryParams = new URLSearchParams();
  resetHistoryParams.set("date", reportDate);
  resetHistoryParams.set("store", selectedStoreId);

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Report bumbu harian</p>
          <h1>Stock bumbu akhir hari</h1>
          <p className="muted">Isi stok bumbu merah dan bumbu putih untuk store masing-masing pada akhir operasional.</p>
        </div>
      </div>

      {params.saved === "1" ? <div className="toast submit">Report bumbu berhasil disimpan.</div> : null}
      {params.deleted === "1" ? <div className="toast delete">Report bumbu berhasil dihapus.</div> : null}

      {params.error === "missing-store" ? (
        <section className="panel alert" style={{ marginBottom: 16 }}>
          Store belum dipilih atau belum terset di profile. Admin bisa memilih store, staff perlu store di-set melalui Master Data.
        </section>
      ) : null}

      <section className="panel spice-report-panel">
        <form action={saveDailySpiceReport} className="form">
          <div className="filter-grid">
            <div className="field">
              <label>Tanggal</label>
              <input name="report_date" type="date" defaultValue={reportDate} required />
            </div>
            {profile.role === "admin" ? (
              <div className="field">
                <label>Store</label>
                <select name="store_id" defaultValue={selectedStoreId} required>
                  {(stores ?? []).map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <>
                <input name="store_id" type="hidden" value={selectedStoreId} />
                <div className="field">
                  <label>Store</label>
                  <input disabled value={profile.stores?.name ?? profile.store_name ?? "-"} />
                </div>
              </>
            )}
          </div>

          <div className="spice-stock-grid">
            <div className="field spice-stock-card">
              <label>Bumbu Merah</label>
              <input
                defaultValue={report?.red_spice_stock ?? 0}
                min="0"
                name="red_spice_stock"
                step="0.01"
                type="number"
              />
            </div>
            <div className="field spice-stock-card">
              <label>Bumbu Putih</label>
              <input
                defaultValue={report?.white_spice_stock ?? 0}
                min="0"
                name="white_spice_stock"
                step="0.01"
                type="number"
              />
            </div>
          </div>

          <div className="field">
            <label>Catatan</label>
            <textarea defaultValue={report?.notes ?? ""} name="notes" placeholder="Opsional" rows={3} />
          </div>

          <div className="row-actions">
            <button className="button primary" type="submit">
              Simpan Report Bumbu
            </button>
          </div>
        </form>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="page-head compact">
          <div>
            <p className="eyebrow">History</p>
            <h2>Riwayat stock bumbu</h2>
          </div>
        </div>
        <form className="filter-grid" style={{ marginBottom: 14 }}>
          <input name="date" type="hidden" value={reportDate} />
          <input name="store" type="hidden" value={selectedStoreId} />
          <div className="field">
            <label>Tanggal History</label>
            <input name="history_date" type="date" defaultValue={historyDate} />
          </div>
          {profile.role === "admin" ? (
            <div className="field">
              <label>Store History</label>
              <select name="history_store" defaultValue={historyStore}>
                <option value="all">All Store</option>
                {(stores ?? []).map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </div>
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
            Filter History
          </button>
          <Link className="button outline" href={`/reports/spices?${resetHistoryParams}`}>
            Reset
          </Link>
        </form>
        {historyReports?.length ? (
          <>
            <div className="table-wrap compact-mobile-wrap">
              <table className="compact-mobile-table">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Store</th>
                    <th>Bumbu Merah</th>
                    <th>Bumbu Putih</th>
                    <th>Catatan</th>
                    {profile.role === "admin" ? <th>Aksi</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {historyReports.map((item) => (
                    <tr key={item.id}>
                      <td>{item.report_date}</td>
                      <td>{item.store_name}</td>
                      <td>{Number(item.red_spice_stock)}</td>
                      <td>{Number(item.white_spice_stock)}</td>
                      <td>{item.notes ?? "-"}</td>
                      {profile.role === "admin" ? (
                        <td>
                          <form action={deleteDailySpiceReport}>
                            <input name="id" type="hidden" value={item.id} />
                            <input name="redirect_to" type="hidden" value={currentPath} />
                            <button className="button danger" type="submit">
                              Hapus
                            </button>
                          </form>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <a className={`button outline ${currentPage <= 1 ? "disabled-link" : ""}`} href={`/reports/spices?${previousParams}`}>
                Previous
              </a>
              <span className="muted">
                Page {currentPage} of {totalPages}
              </span>
              <a className={`button outline ${currentPage >= totalPages ? "disabled-link" : ""}`} href={`/reports/spices?${nextParams}`}>
                Next
              </a>
            </div>
          </>
        ) : (
          <p className="muted">Belum ada history report bumbu.</p>
        )}
      </section>
    </>
  );
}
