import { redirect } from "next/navigation";
import { Suspense } from "react";
import { HistoryDateRangeField } from "@/app/(app)/reports/sales/HistoryDateRangeField";
import { createClient } from "@/lib/supabase/server";
import type { Profile, ShoppingRecord, Store } from "@/lib/types";
import { ImportShoppingButton } from "./ImportShoppingButton";
import { ShoppingDetailButton } from "./ShoppingDetailButton";
import { ShoppingRecordForm } from "./ShoppingRecordForm";
import { ShoppingSavedModal } from "./ShoppingSavedModal";
import { deleteShoppingRecord } from "./actions";

function todayJakarta() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

type SearchParams = Promise<{
  chart_category?: string;
  chart_date_from?: string;
  chart_date_to?: string;
  chart_payment?: string;
  chart_store?: string;
  category?: string;
  deleted?: string;
  edit?: string;
  error?: string;
  history_date_from?: string;
  history_date_to?: string;
  page?: string;
  page_size?: string;
  payment_status?: string;
  q?: string;
  saved?: string;
  sort?: string;
  store?: string;
}>;

type ShoppingSheetRow = {
  byName: string;
  description: string;
  id: string;
  kategori: string;
  nominal: number;
  notes: string;
  paymentMethod: string;
  paymentStatus: string;
  storeCode: string;
  storeId: string;
  storeName: string;
  tanggal: string;
};

function errorMessage(error?: string) {
  if (error === "missing-store") return "Store belum dipilih atau belum terset di profile.";
  if (error === "save-failed") return "Belanja gagal disimpan. Silakan coba lagi.";
  return null;
}

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    currency: "IDR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function formatDisplayDate(value: string) {
  if (!value) return "-";
  const ddmmyyyy = value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (ddmmyyyy) return value;

  const yyyymmdd = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (yyyymmdd) return `${yyyymmdd[3]}-${yyyymmdd[2]}-${yyyymmdd[1]}`;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Jakarta",
    year: "numeric",
  }).format(date).replaceAll("/", "-");
}

function filterDateValue(value: string) {
  if (!value) return "";
  const ddmmyyyy = value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;

  const yyyymmdd = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (yyyymmdd) return `${yyyymmdd[1]}-${yyyymmdd[2]}-${yyyymmdd[3]}`;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Jakarta",
    year: "numeric",
  }).format(date);
}

function dateSortValue(value: string) {
  const normalized = filterDateValue(value);
  if (!normalized) return 0;
  const date = new Date(`${normalized}T00:00:00+07:00`);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function monthStartJakarta() {
  return `${todayJakarta().slice(0, 7)}-01`;
}

function normalizeOption(value: string) {
  return value.trim().toLowerCase();
}

function paymentStatusLabel(value: string) {
  const normalized = normalizeOption(value);
  if (normalized === "paid" || normalized === "lunas" || normalized === "sudah_lunas" || normalized === "sudah dibayar") return "Paid";
  if (normalized === "unpaid" || normalized === "belum_lunas" || normalized === "belum dibayar") return "Unpaid";
  return "-";
}

function isPaymentStatusPaid(value: string) {
  const normalized = normalizeOption(value);
  return normalized === "paid" || normalized === "lunas" || normalized === "sudah_lunas" || normalized === "sudah dibayar";
}

async function fetchShoppingRows(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data, error } = await supabase
    .from("shopping_records")
    .select("*")
    .order("record_date", { ascending: false })
    .limit(1000)
    .returns<ShoppingRecord[]>();

  if (error) {
    return { error: "Gagal mengambil data belanja.", rows: [] as ShoppingSheetRow[] };
  }

  const rows: ShoppingSheetRow[] = (data ?? []).map((record) => ({
    byName: record.by_name ?? "",
    description: record.description,
    id: record.id,
    kategori: record.category,
    nominal: Number(record.total_price),
    notes: record.notes ?? "",
    paymentMethod: record.payment_method,
    paymentStatus: record.payment_status,
    storeCode: record.store_code ?? "",
    storeId: record.store_id,
    storeName: record.store_name,
    tanggal: record.record_date,
  }));

  return { error: null as string | null, rows };
}

export default async function ShoppingRecordPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*, stores(*)").eq("id", user.id).single<Profile>();
  if (!profile || profile.role === "vendor") redirect("/dashboard");

  const params = await searchParams;
  const editId = profile.role === "admin" ? params.edit ?? "" : "";
  const [{ data: stores }, shoppingHistory, { data: editingRecord }] = await Promise.all([
    profile.role === "admin"
      ? supabase.from("stores").select("*").eq("is_active", true).order("name").returns<Store[]>()
      : Promise.resolve({ data: [] as Store[] }),
    fetchShoppingRows(supabase),
    editId
      ? supabase.from("shopping_records").select("*").eq("id", editId).maybeSingle<ShoppingRecord>()
      : Promise.resolve({ data: null as ShoppingRecord | null }),
  ]);
  const selectedStoreId = profile.role === "admin" ? params.store ?? stores?.[0]?.id ?? "" : profile.store_id ?? "";
  const error = errorMessage(params.error);
  const pageSizeOptions = [10, 20, 50, 100, 500];
  const requestedPageSize = Number(params.page_size ?? 10);
  const pageSize = pageSizeOptions.includes(requestedPageSize) ? requestedPageSize : 10;
  const selectedCategory = params.category ?? "all";
  const selectedChartCategory = params.chart_category ?? "all";
  const selectedChartPayment = params.chart_payment ?? "all";
  const selectedChartStore = profile.role === "admin" ? params.chart_store ?? "all" : selectedStoreId;
  const chartDateFrom = params.chart_date_from ?? monthStartJakarta();
  const chartDateTo = params.chart_date_to ?? todayJakarta();
  const historyDateFrom = params.history_date_from ?? monthStartJakarta();
  const historyDateTo = params.history_date_to ?? todayJakarta();
  const selectedPaymentStatus = params.payment_status ?? "all";
  const descriptionQuery = (params.q ?? "").trim().toLowerCase();
  const selectedSort = params.sort ?? "date_desc";
  const categoryOptions = Array.from(
    new Set(["belanja", "operasional", "bahan baku", "transport", "lainnya", ...shoppingHistory.rows.map((row) => row.kategori).filter(Boolean)]),
  ).sort((a, b) => a.localeCompare(b));
  const paymentOptions = Array.from(new Set(shoppingHistory.rows.map((row) => row.paymentMethod).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const storeOptionsFromRows = Array.from(
    new Map(
      shoppingHistory.rows
        .filter((row) => row.storeId || row.storeName || row.storeCode)
        .map((row) => [row.storeId || row.storeName || row.storeCode, { code: row.storeCode, id: row.storeId, name: row.storeName }]),
    ).values(),
  ).sort((a, b) => (a.code || a.name).localeCompare(b.code || b.name));
  const chartRows = shoppingHistory.rows.filter((row) => {
    const rowDate = filterDateValue(row.tanggal);
    const matchesDateFrom = !chartDateFrom || rowDate >= chartDateFrom;
    const matchesDateTo = !chartDateTo || rowDate <= chartDateTo;
    const matchesCategory = selectedChartCategory === "all" || normalizeOption(row.kategori) === normalizeOption(selectedChartCategory);
    const matchesPayment = selectedChartPayment === "all" || normalizeOption(row.paymentMethod) === normalizeOption(selectedChartPayment);
    const matchesStore =
      selectedChartStore === "all" ||
      row.storeId === selectedChartStore ||
      row.storeCode === selectedChartStore ||
      row.storeName === selectedChartStore ||
      (stores ?? []).find((store) => store.id === selectedChartStore && (store.id === row.storeId || store.code === row.storeCode || store.name === row.storeName));
    return Boolean(rowDate && matchesDateFrom && matchesDateTo && matchesCategory && matchesPayment && matchesStore);
  });
  const totalShopping = chartRows.reduce((sum, row) => sum + row.nominal, 0);
  const averageShopping = chartRows.length ? totalShopping / chartRows.length : 0;
  const categoryTotals = Array.from(
    chartRows.reduce((map, row) => {
      const key = row.kategori || "Tanpa kategori";
      map.set(key, (map.get(key) ?? 0) + row.nominal);
      return map;
    }, new Map<string, number>()),
  ).sort((a, b) => b[1] - a[1]);
  const paymentTotals = Array.from(
    chartRows.reduce((map, row) => {
      const key = row.paymentMethod || "Tanpa metode";
      map.set(key, (map.get(key) ?? 0) + row.nominal);
      return map;
    }, new Map<string, number>()),
  ).sort((a, b) => b[1] - a[1]);
  const storeTotals = Array.from(
    chartRows.reduce((map, row) => {
      const key = row.storeCode || row.storeName || "Tanpa store";
      map.set(key, (map.get(key) ?? 0) + row.nominal);
      return map;
    }, new Map<string, number>()),
  ).sort((a, b) => b[1] - a[1]);
  const dailyTotals = Array.from(
    chartRows.reduce((map, row) => {
      const key = filterDateValue(row.tanggal);
      if (key) map.set(key, (map.get(key) ?? 0) + row.nominal);
      return map;
    }, new Map<string, number>()),
  ).sort((a, b) => a[0].localeCompare(b[0]));
  const paymentStatusTotals = [
    ["Paid", chartRows.filter((row) => isPaymentStatusPaid(row.paymentStatus)).reduce((sum, row) => sum + row.nominal, 0), chartRows.filter((row) => isPaymentStatusPaid(row.paymentStatus)).length],
    ["Unpaid", chartRows.filter((row) => !isPaymentStatusPaid(row.paymentStatus)).reduce((sum, row) => sum + row.nominal, 0), chartRows.filter((row) => !isPaymentStatusPaid(row.paymentStatus)).length],
  ] as const;
  const maxCategoryTotal = Math.max(...categoryTotals.map(([, total]) => total), 1);
  const maxPaymentTotal = Math.max(...paymentTotals.map(([, total]) => total), 1);
  const maxStoreTotal = Math.max(...storeTotals.map(([, total]) => total), 1);
  const maxDailyTotal = Math.max(...dailyTotals.map(([, total]) => total), 1);
  const maxPaymentStatusTotal = Math.max(...paymentStatusTotals.map(([, total]) => total), 1);
  const resetChartParams = new URLSearchParams();
  if (selectedStoreId) resetChartParams.set("store", selectedStoreId);
  const currentPage = Math.max(1, Number(params.page ?? 1) || 1);
  const filteredHistoryRows = shoppingHistory.rows
    .filter((row) => {
      const rowDate = filterDateValue(row.tanggal);
      const matchesDate = (!historyDateFrom || rowDate >= historyDateFrom) && (!historyDateTo || rowDate <= historyDateTo);
      const matchesCategory = selectedCategory === "all" || row.kategori === selectedCategory;
      const matchesDescription = !descriptionQuery || row.description.toLowerCase().includes(descriptionQuery);
      const matchesPaymentStatus =
        selectedPaymentStatus === "all" ||
        (selectedPaymentStatus === "paid" ? isPaymentStatusPaid(row.paymentStatus) : !isPaymentStatusPaid(row.paymentStatus));
      return matchesDate && matchesCategory && matchesDescription && matchesPaymentStatus;
    })
    .sort((a, b) => {
      if (selectedSort === "date_asc") return dateSortValue(a.tanggal) - dateSortValue(b.tanggal);
      if (selectedSort === "category_asc") return a.kategori.localeCompare(b.kategori) || dateSortValue(b.tanggal) - dateSortValue(a.tanggal);
      if (selectedSort === "category_desc") return b.kategori.localeCompare(a.kategori) || dateSortValue(b.tanggal) - dateSortValue(a.tanggal);
      return dateSortValue(b.tanggal) - dateSortValue(a.tanggal);
    });
  const totalPages = Math.max(1, Math.ceil(filteredHistoryRows.length / pageSize));
  const activePage = Math.min(currentPage, totalPages);
  const paginatedHistoryRows = filteredHistoryRows.slice((activePage - 1) * pageSize, activePage * pageSize);
  const historyParams = new URLSearchParams();
  if (selectedStoreId) historyParams.set("store", selectedStoreId);
  if (historyDateFrom) historyParams.set("history_date_from", historyDateFrom);
  if (historyDateTo) historyParams.set("history_date_to", historyDateTo);
  if (selectedCategory !== "all") historyParams.set("category", selectedCategory);
  if (selectedPaymentStatus !== "all") historyParams.set("payment_status", selectedPaymentStatus);
  if (params.q) historyParams.set("q", params.q);
  historyParams.set("page_size", String(pageSize));
  historyParams.set("sort", selectedSort);
  const previousParams = new URLSearchParams(historyParams);
  previousParams.set("page", String(Math.max(1, activePage - 1)));
  const nextParams = new URLSearchParams(historyParams);
  nextParams.set("page", String(Math.min(totalPages, activePage + 1)));
  const resetHistoryParams = new URLSearchParams();
  if (selectedStoreId) resetHistoryParams.set("store", selectedStoreId);
  const unpaidHistoryParams = new URLSearchParams();
  if (selectedStoreId) unpaidHistoryParams.set("store", selectedStoreId);
  unpaidHistoryParams.set("payment_status", "unpaid");

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Pencatatan belanja</p>
          <h1>Input belanja harian</h1>
          <p className="muted">Input dan history belanja tersimpan langsung di database.</p>
        </div>
      </div>

      <Suspense fallback={null}>
        <ShoppingSavedModal />
      </Suspense>
      {error ? <div className="toast delete">{error}</div> : null}
      {params.deleted === "1" ? <div className="toast delete">Belanja berhasil dihapus.</div> : null}

      <section className="panel shopping-panel">
        <ShoppingRecordForm
          categoryOptions={categoryOptions}
          editingRecord={editingRecord}
          key={editingRecord?.id ?? "new"}
          profile={profile}
          recordDate={editingRecord?.record_date ?? todayJakarta()}
          selectedStoreId={editingRecord?.store_id ?? selectedStoreId}
          stores={stores ?? []}
        />
      </section>

      <section className="panel shopping-dashboard-panel">
        <div className="page-head compact">
          <div>
            <p className="eyebrow">Monitoring belanja</p>
            <h2>Dashboard total belanja</h2>
          </div>
        </div>
        <form className="filter-grid shopping-dashboard-filter">
          {selectedStoreId ? <input name="store" type="hidden" value={selectedStoreId} /> : null}
          <div className="field">
            <label>Dari Tanggal</label>
            <input name="chart_date_from" type="date" defaultValue={chartDateFrom} />
          </div>
          <div className="field">
            <label>Sampai Tanggal</label>
            <input name="chart_date_to" type="date" defaultValue={chartDateTo} />
          </div>
          <div className="field">
            <label>Kategori</label>
            <select name="chart_category" defaultValue={selectedChartCategory}>
              <option value="all">All Kategori</option>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Jenis Bayar</label>
            <select name="chart_payment" defaultValue={selectedChartPayment}>
              <option value="all">All Jenis Bayar</option>
              {paymentOptions.map((payment) => (
                <option key={payment} value={payment}>
                  {payment}
                </option>
              ))}
            </select>
          </div>
          {profile.role === "admin" ? (
            <div className="field">
              <label>Store</label>
              <select name="chart_store" defaultValue={selectedChartStore}>
                <option value="all">All Store</option>
                {(stores ?? []).map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.code ? `${store.code} - ${store.name}` : store.name}
                  </option>
                ))}
                {storeOptionsFromRows.map((store) => (
                  <option key={`sheet-${store.id || store.code || store.name}`} value={store.id || store.code || store.name}>
                    {store.code ? `${store.code} - ${store.name || store.code}` : store.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <input name="chart_store" type="hidden" value={selectedChartStore} />
          )}
          <button className="button primary" type="submit">
            Filter Grafik
          </button>
          <a className="button outline" href={`/shopping?${resetChartParams}`}>
            Reset Grafik
          </a>
        </form>

        <div className="shopping-dashboard-cards">
          <div className="shopping-dashboard-card total">
            <span>Total Belanja</span>
            <strong>{formatRupiah(totalShopping)}</strong>
          </div>
          <div className="shopping-dashboard-card">
            <span>Jumlah Transaksi</span>
            <strong>{chartRows.length}</strong>
          </div>
          <div className="shopping-dashboard-card">
            <span>Rata-rata</span>
            <strong>{formatRupiah(averageShopping)}</strong>
          </div>
          <div className="shopping-dashboard-card paid">
            <span>Sudah Dibayar</span>
            <strong>{formatRupiah(paymentStatusTotals[0][1])}</strong>
          </div>
          <div className="shopping-dashboard-card unpaid">
            <span>Belum Dibayar</span>
            <strong>{formatRupiah(paymentStatusTotals[1][1])}</strong>
          </div>
        </div>

        <div className="shopping-chart-grid">
          <div className="shopping-chart-card">
            <h3>Belanja per Tanggal</h3>
            {dailyTotals.length ? (
              <div className="shopping-chart-bars">
                {dailyTotals.map(([date, total]) => (
                  <div className="shopping-chart-row" key={date}>
                    <span>{formatDisplayDate(date)}</span>
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
          <div className="shopping-chart-card">
            <h3>Belanja per Kategori</h3>
            {categoryTotals.length ? (
              <div className="shopping-chart-bars">
                {categoryTotals.map(([category, total]) => (
                  <div className="shopping-chart-row" key={category}>
                    <span>{category}</span>
                    <div>
                      <i style={{ width: `${Math.max(4, (total / maxCategoryTotal) * 100)}%` }} />
                    </div>
                    <strong>{formatRupiah(total)}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">Belum ada data sesuai filter.</p>
            )}
          </div>
          <div className="shopping-chart-card">
            <h3>Belanja per Jenis Bayar</h3>
            {paymentTotals.length ? (
              <div className="shopping-chart-bars">
                {paymentTotals.map(([payment, total]) => (
                  <div className="shopping-chart-row" key={payment}>
                    <span>{payment}</span>
                    <div>
                      <i style={{ width: `${Math.max(4, (total / maxPaymentTotal) * 100)}%` }} />
                    </div>
                    <strong>{formatRupiah(total)}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">Belum ada data sesuai filter.</p>
            )}
          </div>
          <div className="shopping-chart-card">
            <h3>Status Pembayaran</h3>
            {chartRows.length ? (
              <div className="shopping-chart-bars">
                {paymentStatusTotals.map(([status, total, count]) => (
                  <div className="shopping-chart-row" key={status}>
                    <span>
                      <span className={`payment-status-badge ${status === "Paid" ? "paid" : "unpaid"}`}>{status}</span> ({count})
                    </span>
                    <div>
                      <i style={{ width: `${Math.max(4, (total / maxPaymentStatusTotal) * 100)}%` }} />
                    </div>
                    <strong>{formatRupiah(total)}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">Belum ada data sesuai filter.</p>
            )}
          </div>
          {profile.role === "admin" ? (
            <div className="shopping-chart-card">
              <h3>Belanja per Store</h3>
              {storeTotals.length ? (
                <div className="shopping-chart-bars">
                  {storeTotals.map(([store, total]) => (
                    <div className="shopping-chart-row" key={store}>
                      <span>{store}</span>
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
          ) : null}
        </div>
      </section>

      <section className="panel shopping-history-panel">
        <div className="page-head compact">
          <div>
            <p className="eyebrow">History</p>
            <h2>List belanja terakhir</h2>
          </div>
          {profile.role === "admin" ? <ImportShoppingButton /> : null}
        </div>
        <form className="filter-grid" style={{ marginBottom: 14 }}>
          {selectedStoreId ? <input name="store" type="hidden" value={selectedStoreId} /> : null}
          <HistoryDateRangeField
            defaultFrom={historyDateFrom}
            defaultTo={historyDateTo}
            label="Tanggal"
            nameFrom="history_date_from"
            nameTo="history_date_to"
          />
          <div className="field">
            <label>Kategori</label>
            <select name="category" defaultValue={selectedCategory}>
              <option value="all">All Kategori</option>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Status Pembayaran</label>
            <select name="payment_status" defaultValue={selectedPaymentStatus}>
              <option value="all">All Status</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
            </select>
          </div>
          <div className="field">
            <label>Deskripsi</label>
            <input name="q" defaultValue={params.q ?? ""} placeholder="Cari deskripsi..." />
          </div>
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
          <div className="field">
            <label>Sort By</label>
            <select name="sort" defaultValue={selectedSort}>
              <option value="date_desc">Tanggal Terbaru</option>
              <option value="date_asc">Tanggal Terlama</option>
              <option value="category_asc">Kategori A-Z</option>
              <option value="category_desc">Kategori Z-A</option>
            </select>
          </div>
          <input name="page" type="hidden" value="1" />
          <button className="button primary" type="submit">
            Filter
          </button>
          <a className="button outline" href={`/shopping?${resetHistoryParams}`}>
            Reset
          </a>
          <a className={`button outline ${selectedPaymentStatus === "unpaid" ? "active" : ""}`} href={`/shopping?${unpaidHistoryParams}`}>
            Tampilkan Unpaid
          </a>
        </form>
        {shoppingHistory.error ? <div className="alert">{shoppingHistory.error}</div> : null}
        {paginatedHistoryRows.length ? (
          <div className="table-wrap compact-mobile-wrap">
            <table className="compact-mobile-table shopping-history-table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>By</th>
                  <th>Deskripsi</th>
                  <th>Nominal</th>
                  <th>Kategori</th>
                  <th>Metode</th>
                  <th>Status</th>
                  <th>Detail</th>
                  {profile.role === "admin" ? <th>Aksi</th> : null}
                </tr>
              </thead>
              <tbody>
                {paginatedHistoryRows.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDisplayDate(row.tanggal)}</td>
                    <td>{row.byName || "-"}</td>
                    <td>{row.description || "-"}</td>
                    <td>{formatRupiah(row.nominal)}</td>
                    <td>{row.kategori || "-"}</td>
                    <td>{row.paymentMethod || "-"}</td>
                    <td>
                      <span className={`payment-status-badge ${isPaymentStatusPaid(row.paymentStatus) ? "paid" : "unpaid"}`}>
                        {paymentStatusLabel(row.paymentStatus)}
                      </span>
                    </td>
                    <td>
                      <ShoppingDetailButton notes={row.notes} paymentMethod={row.paymentMethod} paymentStatus={row.paymentStatus} />
                    </td>
                    {profile.role === "admin" ? (
                      <td>
                        <div className="row-actions compact-actions">
                          <a className="button outline" href={`/shopping?${new URLSearchParams({ ...Object.fromEntries(historyParams), edit: row.id })}`}>
                            Edit
                          </a>
                          <form action={deleteShoppingRecord}>
                            <input name="id" type="hidden" value={row.id} />
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
        ) : null}
        {filteredHistoryRows.length > 0 ? (
          <div className="pagination">
            <a aria-label="Halaman sebelumnya" className={`button outline ${activePage <= 1 ? "disabled-link" : ""}`} href={`/shopping?${previousParams}`}>
              ‹
            </a>
            <span className="muted">
              {activePage} / {totalPages}
            </span>
            <a aria-label="Halaman berikutnya" className={`button outline ${activePage >= totalPages ? "disabled-link" : ""}`} href={`/shopping?${nextParams}`}>
              ›
            </a>
          </div>
        ) : null}
        {!shoppingHistory.error && shoppingHistory.rows.length > 0 && filteredHistoryRows.length === 0 ? (
          <p className="muted">Tidak ada data belanja sesuai filter.</p>
        ) : null}
      </section>
    </>
  );
}
