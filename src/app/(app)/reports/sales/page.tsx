import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { DailySalesReport, Profile, Store } from "@/lib/types";
import { SalesDetailButton } from "./SalesDetailButton";
import { SalesReportForm } from "./SalesReportForm";
import { deleteDailySalesReport } from "./actions";

function todayJakarta() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    currency: "IDR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

type SearchParams = Promise<{
  date?: string;
  deleted?: string;
  error?: string;
  history_date?: string;
  history_store?: string;
  page?: string;
  page_size?: string;
  saved?: string;
  store?: string;
}>;

export default async function DailySalesReportPage({ searchParams }: { searchParams: SearchParams }) {
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
        .from("daily_sales_reports")
        .select("*")
        .eq("report_date", reportDate)
        .eq("store_id", selectedStoreId)
        .maybeSingle<DailySalesReport>()
    : { data: null };

  const historyQuery = supabase
    .from("daily_sales_reports")
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

  const { data: historyReports, count: historyCount } = await historyQuery.returns<DailySalesReport[]>();
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
  const currentPath = `/reports/sales?${currentParams}`;
  const resetHistoryParams = new URLSearchParams();
  resetHistoryParams.set("date", reportDate);
  resetHistoryParams.set("store", selectedStoreId);

  function editHref(item: DailySalesReport) {
    const editParams = new URLSearchParams(currentParams);
    editParams.set("date", item.report_date);
    editParams.set("store", item.store_id);
    return `/reports/sales?${editParams}`;
  }

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Report sales harian</p>
          <h1>Sales akhir hari</h1>
          <p className="muted">Isi nominal system, rincian tunai, payment non-tunai, pengeluaran, dan selisih harian.</p>
        </div>
      </div>

      {params.saved === "1" ? <div className="toast submit">Report sales berhasil disimpan.</div> : null}
      {params.deleted === "1" ? <div className="toast delete">Report sales berhasil dihapus.</div> : null}

      {params.error === "missing-store" ? (
        <section className="panel alert" style={{ marginBottom: 16 }}>
          Store belum dipilih atau belum terset di profile. Admin bisa memilih store, staff perlu store di-set melalui Master Data.
        </section>
      ) : null}

      <section className="panel sales-report-panel">
        <SalesReportForm
          key={`${selectedStoreId}-${reportDate}-${report?.id ?? "new"}`}
          profile={profile}
          report={report ?? null}
          reportDate={reportDate}
          selectedStoreId={selectedStoreId}
          stores={stores ?? []}
        />
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="page-head compact">
          <div>
            <p className="eyebrow">History</p>
            <h2>Riwayat sales harian</h2>
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
          <Link className="button outline" href={`/reports/sales?${resetHistoryParams}`}>
            Reset
          </Link>
        </form>
        {historyReports?.length ? (
          <>
            <div className="table-wrap compact-mobile-wrap">
              <table className="compact-mobile-table sales-history-table">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Store</th>
                    <th>System</th>
                    <th>Tunai</th>
                    <th>Qris</th>
                    <th>Debit</th>
                    <th>Shopee</th>
                    <th>Pengeluaran</th>
                    <th>Selisih</th>
                    <th>Detail</th>
                    {profile.role === "admin" ? <th>Aksi</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {historyReports.map((item) => (
                    <tr key={item.id}>
                      <td>{item.report_date}</td>
                      <td>{item.store_name}</td>
                      <td>{formatRupiah(Number(item.system_nominal))}</td>
                      <td>{formatRupiah(Number(item.cash_total))}</td>
                      <td>{formatRupiah(Number(item.qris))}</td>
                      <td>{formatRupiah(Number(item.debit))}</td>
                      <td>{formatRupiah(Number(item.shopee))}</td>
                      <td>{formatRupiah(Number(item.expense))}</td>
                      <td>
                        <span className={`sales-difference ${Number(item.difference) === 0 ? "balanced" : Number(item.difference) > 0 ? "plus" : "minus"}`}>
                          {formatRupiah(Number(item.difference))}
                        </span>
                      </td>
                      <td>
                        <SalesDetailButton expenseDetail={item.expense_detail} notes={item.notes} />
                      </td>
                      {profile.role === "admin" ? (
                        <td>
                          <div className="row-actions compact-actions">
                            <Link className="button outline" href={editHref(item)}>
                              Edit
                            </Link>
                            <form action={deleteDailySalesReport}>
                              <input name="id" type="hidden" value={item.id} />
                              <input name="redirect_to" type="hidden" value={currentPath} />
                              <button className="button danger" type="submit">
                                Hapus
                              </button>
                            </form>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <a className={`button outline ${currentPage <= 1 ? "disabled-link" : ""}`} href={`/reports/sales?${previousParams}`}>
                Previous
              </a>
              <span className="muted">
                Page {currentPage} of {totalPages}
              </span>
              <a className={`button outline ${currentPage >= totalPages ? "disabled-link" : ""}`} href={`/reports/sales?${nextParams}`}>
                Next
              </a>
            </div>
          </>
        ) : (
          <p className="muted">Belum ada history report sales.</p>
        )}
      </section>
    </>
  );
}
