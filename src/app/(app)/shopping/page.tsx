import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Store } from "@/lib/types";
import { ShoppingDetailButton } from "./ShoppingDetailButton";
import { ShoppingRecordForm } from "./ShoppingRecordForm";
import { ShoppingSavedModal } from "./ShoppingSavedModal";

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
  error?: string;
  history_date?: string;
  page?: string;
  page_size?: string;
  q?: string;
  saved?: string;
  sort?: string;
  status?: string;
  store?: string;
}>;

type ShoppingSheetRow = {
  command: string;
  description: string;
  kategori: string;
  nominal: number;
  notes: string;
  paymentMethod: string;
  source: string;
  storeCode: string;
  storeId: string;
  storeName: string;
  tanggal: string;
};

function errorMessage(error?: string, status?: string) {
  if (error === "missing-script-url") return "GOOGLE_APPS_SCRIPT_URL belum diisi di environment.";
  if (error === "missing-store") return "Store belum dipilih atau belum terset di profile.";
  if (error === "fetch-failed") return "Gagal menghubungi Google Apps Script. Cek URL Web App dan akses deployment Apps Script.";
  if (error === "script-failed") return `Google Apps Script gagal menerima data${status ? ` (status ${status})` : ""}.`;
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

function fieldValue(row: Record<string, unknown>, keys: string[]) {
  const normalizedEntries = Object.entries(row).map(([key, value]) => [key.toLowerCase(), value] as const);
  for (const key of keys) {
    const match = normalizedEntries.find(([entryKey]) => entryKey === key.toLowerCase());
    if (match) return match[1];
  }
  return "";
}

function nestedDataValue(row: Record<string, unknown>, keys: string[]) {
  const data = row.data;
  if (!data || typeof data !== "object") return "";
  return fieldValue(data as Record<string, unknown>, keys);
}

function normalizeSheetRows(rawRows: unknown): ShoppingSheetRow[] {
  if (!Array.isArray(rawRows)) return [];

  return rawRows
    .map((row) => {
      if (Array.isArray(row)) {
        const hasPaymentStoreColumns = row.length >= 8;
        const hasLegacyExtendedColumns = row.length >= 8 && !row[6] && !row[7];
        return {
          tanggal: String(row[0] ?? ""),
          description: String(row[1] ?? ""),
          nominal: Number(row[2] ?? 0),
          kategori: String(row[3] ?? ""),
          paymentMethod: hasPaymentStoreColumns ? String(row[4] ?? "") : "",
          notes: "",
          source: hasPaymentStoreColumns ? String(row[6] ?? "") : String(row[4] ?? ""),
          command: hasPaymentStoreColumns ? String(row[7] ?? "") : String(row[5] ?? ""),
          storeCode: hasPaymentStoreColumns ? String(row[5] ?? "") : "",
          storeId: "",
          storeName: hasLegacyExtendedColumns ? String(row[10] ?? "") : hasPaymentStoreColumns ? String(row[5] ?? "") : "",
        };
      }

      if (row && typeof row === "object") {
        const record = row as Record<string, unknown>;
        return {
          tanggal: String(fieldValue(record, ["tanggal", "date", "created_at"]) ?? ""),
          description: String(fieldValue(record, ["deskripsi", "description"]) ?? ""),
          nominal: Number(fieldValue(record, ["nominal", "amount", "total"]) ?? 0),
          kategori: String(fieldValue(record, ["kategori", "category"]) ?? ""),
          paymentMethod: String(fieldValue(record, ["metode pembayaran", "payment_method", "paymentMethod", "payment"]) ?? ""),
          notes: String(fieldValue(record, ["catatan", "notes", "note"]) ?? ""),
          source: String(fieldValue(record, ["sumber", "source"]) ?? ""),
          command: String(fieldValue(record, ["command", "text"]) ?? ""),
          storeCode: String(fieldValue(record, ["store_code", "storeCode", "kode store", "kode toko"]) || nestedDataValue(record, ["store_code", "storeCode"]) || ""),
          storeId: String(fieldValue(record, ["store_id", "storeId"]) || nestedDataValue(record, ["store_id", "storeId"]) || ""),
          storeName: String(fieldValue(record, ["store_name", "storeName", "store", "toko"]) || nestedDataValue(record, ["store_name", "storeName"]) || ""),
        };
      }

      return null;
    })
    .filter((row): row is ShoppingSheetRow => Boolean(row && (row.description || row.nominal || row.kategori)));
}

function monthStartJakarta() {
  return `${todayJakarta().slice(0, 7)}-01`;
}

function normalizeOption(value: string) {
  return value.trim().toLowerCase();
}

async function fetchShoppingRows() {
  const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
  if (!scriptUrl) return { error: "GOOGLE_APPS_SCRIPT_URL belum diisi.", rows: [] as ShoppingSheetRow[] };

  const url = new URL(scriptUrl);
  url.searchParams.set("action", "list_shopping_records");
  url.searchParams.set("limit", "500");
  const token = process.env.GOOGLE_APPS_SCRIPT_TOKEN ?? "";
  if (token) url.searchParams.set("token", token);

  try {
    const response = await fetch(url, { cache: "no-store", redirect: "follow" });
    const text = await response.text();
    if (!response.ok) {
      return { error: `Google Apps Script gagal mengambil list belanja (${response.status}).`, rows: [] as ShoppingSheetRow[] };
    }

    const json = JSON.parse(text) as Record<string, unknown>;
    const rawRows = json.records ?? json.rows ?? json.data ?? json.values;
    const rows = normalizeSheetRows(rawRows);
    const error = rows.length === 0 ? "Belum ada data list dari Apps Script. Pastikan doGet mendukung action list_shopping_records." : null;
    return { error, rows };
  } catch {
    return { error: "Gagal membaca list belanja dari Google Apps Script.", rows: [] as ShoppingSheetRow[] };
  }
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
  const { data: stores } = profile.role === "admin"
    ? await supabase.from("stores").select("*").eq("is_active", true).order("name").returns<Store[]>()
    : { data: [] as Store[] };
  const selectedStoreId = profile.role === "admin" ? params.store ?? stores?.[0]?.id ?? "" : profile.store_id ?? "";
  const error = errorMessage(params.error, params.status);
  const shoppingHistory = await fetchShoppingRows();
  const pageSizeOptions = [10, 20, 50, 100, 500];
  const requestedPageSize = Number(params.page_size ?? 10);
  const pageSize = pageSizeOptions.includes(requestedPageSize) ? requestedPageSize : 10;
  const selectedCategory = params.category ?? "all";
  const selectedChartCategory = params.chart_category ?? "all";
  const selectedChartPayment = params.chart_payment ?? "all";
  const selectedChartStore = profile.role === "admin" ? params.chart_store ?? "all" : selectedStoreId;
  const chartDateFrom = params.chart_date_from ?? monthStartJakarta();
  const chartDateTo = params.chart_date_to ?? todayJakarta();
  const historyDate = params.history_date ?? "";
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
  const maxCategoryTotal = Math.max(...categoryTotals.map(([, total]) => total), 1);
  const maxPaymentTotal = Math.max(...paymentTotals.map(([, total]) => total), 1);
  const maxStoreTotal = Math.max(...storeTotals.map(([, total]) => total), 1);
  const maxDailyTotal = Math.max(...dailyTotals.map(([, total]) => total), 1);
  const resetChartParams = new URLSearchParams();
  if (selectedStoreId) resetChartParams.set("store", selectedStoreId);
  const currentPage = Math.max(1, Number(params.page ?? 1) || 1);
  const filteredHistoryRows = shoppingHistory.rows
    .filter((row) => {
      const matchesDate = !historyDate || filterDateValue(row.tanggal) === historyDate;
      const matchesCategory = selectedCategory === "all" || row.kategori === selectedCategory;
      const matchesDescription = !descriptionQuery || row.description.toLowerCase().includes(descriptionQuery);
      return matchesDate && matchesCategory && matchesDescription;
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
  if (historyDate) historyParams.set("history_date", historyDate);
  if (selectedCategory !== "all") historyParams.set("category", selectedCategory);
  if (params.q) historyParams.set("q", params.q);
  historyParams.set("page_size", String(pageSize));
  historyParams.set("sort", selectedSort);
  const previousParams = new URLSearchParams(historyParams);
  previousParams.set("page", String(Math.max(1, activePage - 1)));
  const nextParams = new URLSearchParams(historyParams);
  nextParams.set("page", String(Math.min(totalPages, activePage + 1)));
  const resetHistoryParams = new URLSearchParams();
  if (selectedStoreId) resetHistoryParams.set("store", selectedStoreId);

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Pencatatan belanja</p>
          <h1>Input belanja harian</h1>
          <p className="muted">Input belanja akan dikirim ke Google Sheet, lalu history dibaca kembali dari Sheet1.</p>
        </div>
      </div>

      <Suspense fallback={null}>
        <ShoppingSavedModal />
      </Suspense>
      {error ? <div className="toast delete">{error}</div> : null}

      <section className="panel shopping-panel">
        <ShoppingRecordForm
          categoryOptions={categoryOptions}
          profile={profile}
          recordDate={todayJakarta()}
          selectedStoreId={selectedStoreId}
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
            <p className="eyebrow">History Google Sheet</p>
            <h2>List belanja terakhir</h2>
          </div>
        </div>
        <form className="filter-grid" style={{ marginBottom: 14 }}>
          {selectedStoreId ? <input name="store" type="hidden" value={selectedStoreId} /> : null}
          <div className="field">
            <label>Tanggal</label>
            <input name="history_date" type="date" defaultValue={historyDate} />
          </div>
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
        </form>
        {shoppingHistory.error ? <div className="alert">{shoppingHistory.error}</div> : null}
        {paginatedHistoryRows.length ? (
          <div className="table-wrap compact-mobile-wrap">
            <table className="compact-mobile-table shopping-history-table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Deskripsi</th>
                  <th>Nominal</th>
                  <th>Kategori</th>
                  <th>Metode</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {paginatedHistoryRows.map((row, index) => (
                  <tr key={`${row.tanggal}-${row.description}-${index}`}>
                    <td>{formatDisplayDate(row.tanggal)}</td>
                    <td>{row.description || "-"}</td>
                    <td>{formatRupiah(row.nominal)}</td>
                    <td>{row.kategori || "-"}</td>
                    <td>{row.paymentMethod || "-"}</td>
                    <td>
                      <ShoppingDetailButton notes={row.notes} paymentMethod={row.paymentMethod} />
                    </td>
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
