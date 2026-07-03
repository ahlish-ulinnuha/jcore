import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import type { DailySalesReport, Profile, Store } from "@/lib/types";
import { SalesDetailButton } from "./SalesDetailButton";
import { SalesReportForm } from "./SalesReportForm";
import { SalesSavedModal } from "./SalesSavedModal";
import { deleteDailySalesReport } from "./actions";

function todayJakarta() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function monthStartJakarta() {
  return `${todayJakarta().slice(0, 7)}-01`;
}

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    currency: "IDR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

type SearchParams = Promise<{
  chart_date_from?: string;
  chart_date_to?: string;
  chart_method?: string;
  chart_store?: string;
  date?: string;
  deleted?: string;
  error?: string;
  history_date_from?: string;
  history_date_to?: string;
  history_store?: string;
  page?: string;
  page_size?: string;
  saved?: string;
  store?: string;
}>;

const salesMethodOptions = [
  { key: "all", label: "All Metode" },
  { key: "cash", label: "Cash" },
  { key: "qris", label: "QR" },
  { key: "debit", label: "Debit" },
  { key: "online", label: "Online" },
  { key: "shopee", label: "Shopee" },
  { key: "grab", label: "Grab" },
  { key: "gojek", label: "Gojek" },
] as const;

function salesValueByMethod(report: DailySalesReport, method: string) {
  if (method === "cash") return Number(report.cash_total ?? 0);
  if (method === "qris") return Number(report.qris ?? 0);
  if (method === "debit") return Number(report.debit ?? 0);
  if (method === "shopee") return Number(report.shopee ?? 0);
  if (method === "grab") return Number(report.grab ?? 0);
  if (method === "gojek") return Number(report.gojek ?? 0);
  if (method === "online") return Number(report.shopee ?? 0) + Number(report.grab ?? 0) + Number(report.gojek ?? 0);
  return Number(report.cash_total ?? 0) + Number(report.qris ?? 0) + Number(report.debit ?? 0) + Number(report.shopee ?? 0) + Number(report.grab ?? 0) + Number(report.gojek ?? 0);
}

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
  const chartDateFrom = params.chart_date_from ?? monthStartJakarta();
  const chartDateTo = params.chart_date_to ?? todayJakarta();
  const chartMethod = params.chart_method ?? "all";
  const historyDateFrom = params.history_date_from ?? "";
  const historyDateTo = params.history_date_to ?? "";
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
  const chartStore = profile.role === "admin" ? params.chart_store ?? "all" : profile.store_id ?? "all";

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

  if (historyDateFrom) {
    historyQuery.gte("report_date", historyDateFrom);
  }

  if (historyDateTo) {
    historyQuery.lte("report_date", historyDateTo);
  }

  const { data: historyReports, count: historyCount } = await historyQuery.returns<DailySalesReport[]>();
  const chartQuery = supabase
    .from("daily_sales_reports")
    .select("*")
    .gte("report_date", chartDateFrom)
    .lte("report_date", chartDateTo)
    .order("report_date", { ascending: true })
    .order("store_name");

  if (profile.role === "admin" && chartStore !== "all") {
    chartQuery.eq("store_id", chartStore);
  } else if (profile.role === "staff" && profile.store_id) {
    chartQuery.eq("store_id", profile.store_id);
  }

  const { data: chartReports } = profile.role === "admin" ? await chartQuery.returns<DailySalesReport[]>() : { data: [] as DailySalesReport[] };
  const chartRows = chartReports ?? [];
  const chartTotal = chartRows.reduce((sum, item) => sum + salesValueByMethod(item, chartMethod), 0);
  const chartAverage = chartRows.length ? chartTotal / chartRows.length : 0;
  const paymentTotals = [
    ["Cash", chartRows.reduce((sum, item) => sum + Number(item.cash_total ?? 0), 0)],
    ["QR", chartRows.reduce((sum, item) => sum + Number(item.qris ?? 0), 0)],
    ["Debit", chartRows.reduce((sum, item) => sum + Number(item.debit ?? 0), 0)],
  ] as const;
  const onlineTotals = [
    ["Shopee", chartRows.reduce((sum, item) => sum + Number(item.shopee ?? 0), 0)],
    ["Grab", chartRows.reduce((sum, item) => sum + Number(item.grab ?? 0), 0)],
    ["Gojek", chartRows.reduce((sum, item) => sum + Number(item.gojek ?? 0), 0)],
  ] as const;
  const storeTotals = Array.from(
    chartRows.reduce((map, item) => {
      map.set(item.store_name, (map.get(item.store_name) ?? 0) + salesValueByMethod(item, chartMethod));
      return map;
    }, new Map<string, number>()),
  ).sort((a, b) => b[1] - a[1]);
  const dailyTotals = Array.from(
    chartRows.reduce((map, item) => {
      map.set(item.report_date, (map.get(item.report_date) ?? 0) + salesValueByMethod(item, chartMethod));
      return map;
    }, new Map<string, number>()),
  ).sort((a, b) => a[0].localeCompare(b[0]));
  const maxPaymentTotal = Math.max(...paymentTotals.map(([, total]) => total), 1);
  const maxOnlineTotal = Math.max(...onlineTotals.map(([, total]) => total), 1);
  const maxStoreTotal = Math.max(...storeTotals.map(([, total]) => total), 1);
  const maxDailyTotal = Math.max(...dailyTotals.map(([, total]) => total), 1);
  const totalPages = Math.max(1, Math.ceil((historyCount ?? 0) / pageSize));
  const historyParams = new URLSearchParams();
  historyParams.set("date", reportDate);
  historyParams.set("store", selectedStoreId);
  if (historyDateFrom) historyParams.set("history_date_from", historyDateFrom);
  if (historyDateTo) historyParams.set("history_date_to", historyDateTo);
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
  const resetChartParams = new URLSearchParams();
  resetChartParams.set("date", reportDate);
  resetChartParams.set("store", selectedStoreId);

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

      <Suspense fallback={null}>
        <SalesSavedModal />
      </Suspense>
      {params.deleted === "1" ? <div className="toast delete">Report sales berhasil dihapus.</div> : null}

      {params.error === "missing-store" ? (
        <section className="panel alert" style={{ marginBottom: 16 }}>
          Store belum dipilih atau belum terset di profile. Admin bisa memilih store, staff perlu store di-set melalui Master Data.
        </section>
      ) : null}

      <section className="panel sales-report-panel">
        <Suspense fallback={null}>
          <SalesReportForm
            key={`${selectedStoreId}-${reportDate}-${report?.id ?? "new"}`}
            profile={profile}
            report={report ?? null}
            reportDate={reportDate}
            selectedStoreId={selectedStoreId}
            stores={stores ?? []}
          />
        </Suspense>
      </section>

      {profile.role === "admin" ? (
        <section className="panel sales-chart-panel">
          <div className="page-head compact">
            <div>
              <p className="eyebrow">Monitoring sales</p>
              <h2>Grafik penjualan</h2>
            </div>
          </div>
          <form className="filter-grid sales-chart-filter">
            <input name="date" type="hidden" value={reportDate} />
            <input name="store" type="hidden" value={selectedStoreId} />
            <div className="field">
              <label>Dari Tanggal</label>
              <input name="chart_date_from" type="date" defaultValue={chartDateFrom} />
            </div>
            <div className="field">
              <label>Sampai Tanggal</label>
              <input name="chart_date_to" type="date" defaultValue={chartDateTo} />
            </div>
            <div className="field">
              <label>Store</label>
              <select name="chart_store" defaultValue={chartStore}>
                <option value="all">All Store</option>
                {(stores ?? []).map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Metode / Channel</label>
              <select name="chart_method" defaultValue={chartMethod}>
                {salesMethodOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <button className="button primary" type="submit">
              Filter Grafik
            </button>
            <Link className="button outline" href={`/reports/sales?${resetChartParams}`}>
              Reset Grafik
            </Link>
          </form>

          <div className="sales-chart-cards">
            <div className="sales-chart-card total">
              <span>Total Penjualan</span>
              <strong>{formatRupiah(chartTotal)}</strong>
            </div>
            <div className="sales-chart-card">
              <span>Jumlah Report</span>
              <strong>{chartRows.length}</strong>
            </div>
            <div className="sales-chart-card">
              <span>Rata-rata</span>
              <strong>{formatRupiah(chartAverage)}</strong>
            </div>
          </div>

          <div className="sales-chart-grid">
            <div className="sales-chart-box">
              <h3>Trend per Tanggal</h3>
              {dailyTotals.length ? (
                <div className="sales-chart-bars">
                  {dailyTotals.map(([date, total]) => (
                    <div className="sales-chart-row" key={date}>
                      <span>{date}</span>
                      <div>
                        <i style={{ width: `${Math.max(4, (total / maxDailyTotal) * 100)}%` }} />
                      </div>
                      <strong>{formatRupiah(total)}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted">Belum ada data sesuai filter.</p>
              )}
            </div>
            <div className="sales-chart-box">
              <h3>Metode Pembayaran</h3>
              <div className="sales-chart-bars">
                {paymentTotals.map(([method, total]) => (
                  <div className="sales-chart-row" key={method}>
                    <span>{method}</span>
                    <div>
                      <i style={{ width: `${Math.max(4, (total / maxPaymentTotal) * 100)}%` }} />
                    </div>
                    <strong>{formatRupiah(total)}</strong>
                  </div>
                ))}
              </div>
            </div>
            <div className="sales-chart-box">
              <h3>Penjualan Online</h3>
              <div className="sales-chart-bars">
                {onlineTotals.map(([channel, total]) => (
                  <div className="sales-chart-row" key={channel}>
                    <span>{channel}</span>
                    <div>
                      <i style={{ width: `${Math.max(4, (total / maxOnlineTotal) * 100)}%` }} />
                    </div>
                    <strong>{formatRupiah(total)}</strong>
                  </div>
                ))}
              </div>
            </div>
            <div className="sales-chart-box">
              <h3>Penjualan per Store</h3>
              {storeTotals.length ? (
                <div className="sales-chart-bars">
                  {storeTotals.map(([storeName, total]) => (
                    <div className="sales-chart-row" key={storeName}>
                      <span>{storeName}</span>
                      <div>
                        <i style={{ width: `${Math.max(4, (total / maxStoreTotal) * 100)}%` }} />
                      </div>
                      <strong>{formatRupiah(total)}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted">Belum ada data store sesuai filter.</p>
              )}
            </div>
          </div>
        </section>
      ) : null}

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
            <label>Dari Tanggal</label>
            <input name="history_date_from" type="date" defaultValue={historyDateFrom} />
          </div>
          <div className="field">
            <label>Sampai Tanggal</label>
            <input name="history_date_to" type="date" defaultValue={historyDateTo} />
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
                    <th>Grab</th>
                    <th>Gojek</th>
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
                      <td>{formatRupiah(Number(item.grab ?? 0))}</td>
                      <td>{formatRupiah(Number(item.gojek ?? 0))}</td>
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
