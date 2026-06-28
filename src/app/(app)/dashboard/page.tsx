import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, PurchaseRequest, ShiftType, StoreStaffSchedule } from "@/lib/types";
import { RequestStatusForm } from "./RequestStatusForm";

function todayJakarta() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function calendarDate(dateValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(dateValue: string, days: number) {
  const date = calendarDate(dateValue);
  date.setUTCDate(date.getUTCDate() + days);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
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

function getMonthDates(dateValue: string) {
  const [year, month] = dateValue.split("-").map(Number);
  const monthValue = String(month).padStart(2, "0");
  const days = new Date(year, month, 0).getDate();
  return Array.from({ length: days }, (_, index) => `${year}-${monthValue}-${String(index + 1).padStart(2, "0")}`);
}

function getWeekDatesForDate(dateValue: string) {
  const monthDates = getMonthDates(dateValue);
  const weekIndex = Math.floor(Math.max(0, monthDates.indexOf(dateValue)) / 7);
  return monthDates.slice(weekIndex * 7, weekIndex * 7 + 7);
}

function dayLabel(dateValue: string) {
  const date = calendarDate(dateValue);
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
    weekday: "short",
  }).format(date);
}

type SearchParams = Promise<{ date_from?: string; date_to?: string; updated?: string }>;

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
  const currentWeekDates = getWeekDatesForDate(today);
  const params = await searchParams;
  const dateFrom = params.date_from ?? today;
  const dateTo = params.date_to ?? tomorrow;
  const currentParams = new URLSearchParams();
  currentParams.set("date_from", dateFrom);
  currentParams.set("date_to", dateTo);
  const currentPath = `/dashboard?${currentParams}`;
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
  const scheduleQuery = staffStoreId
    ? supabase
        .from("store_staff_schedules")
        .select("*")
        .eq("store_id", staffStoreId)
        .eq("staff_id", profile.id)
        .gte("work_date", currentWeekDates[0])
        .lte("work_date", currentWeekDates[currentWeekDates.length - 1])
        .returns<StoreStaffSchedule[]>()
    : null;
  const shiftTypesQuery = staffStoreId
    ? supabase.from("shift_types").select("*").eq("is_active", true).order("sort_order").returns<ShiftType[]>()
    : null;

  if (staffStoreId) {
    requestCountQuery.eq("store_id", staffStoreId);
    requestsQuery.eq("store_id", staffStoreId);
    unavailableQuery.eq("purchase_requests.store_id", staffStoreId);
  }

  const [{ count: requestCount }, { data: requests }, { count: unavailableCount }, scheduleResult, shiftTypeResult] = await Promise.all([
    requestCountQuery,
    requestsQuery.returns<PurchaseRequest[]>(),
    unavailableQuery,
    scheduleQuery ?? Promise.resolve({ data: [] as StoreStaffSchedule[] }),
    shiftTypesQuery ?? Promise.resolve({ data: [] as ShiftType[] }),
  ]);

  const requestRows = requests ?? [];
  const scheduleMap = new Map((scheduleResult.data ?? []).map((schedule) => [schedule.work_date, schedule]));
  const shiftMap = new Map((shiftTypeResult.data ?? []).map((shift) => [shift.code, shift]));
  const scheduleError = "error" in scheduleResult ? scheduleResult.error : null;

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

      {profile.role === "staff" ? (
        <section className="panel dashboard-schedule-panel">
          <div className="page-head compact">
            <div>
              <p className="eyebrow">Schedule minggu ini</p>
              <h2>{displayDate(currentWeekDates[0])} - {displayDate(currentWeekDates[currentWeekDates.length - 1])}</h2>
            </div>
            <Link className="button outline" href={`/schedules?month=${today.slice(0, 7)}`}>
              Lihat Full My Schedule
            </Link>
          </div>
          <div className="dashboard-schedule-grid">
            {currentWeekDates.map((date) => {
              const schedule = scheduleMap.get(date);
              const shift = schedule?.shift_code ? shiftMap.get(schedule.shift_code) : null;
              const isToday = date === today;
              return (
                <div className={`dashboard-schedule-day ${isToday ? "today" : ""}`} key={date}>
                  <span>{dayLabel(date)}</span>
                  <strong>{schedule?.shift_code ?? "-"}</strong>
                  <p>{shift ? shift.name : "Belum ada schedule"}</p>
                  {schedule?.notes ? <small>{schedule.notes}</small> : null}
                </div>
              );
            })}
          </div>
          {scheduleError ? (
            <div className="alert" style={{ marginTop: 12 }}>
              Schedule belum bisa dibaca: {scheduleError.message}
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="panel" style={{ marginTop: 18 }}>
        {params.updated === "1" ? <div className="toast submit">Status request berhasil diubah.</div> : null}
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
          <Link className="button outline" href="/dashboard">
            Reset
          </Link>
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
                    <div className="row-actions">
                      {profile.role === "admin" ? <RequestStatusForm currentPath={currentPath} request={request} /> : null}
                      <Link className="button" href={`/requests/${request.id}/edit`}>
                        {request.status === "draft" ? "Edit Draft" : "Lihat"}
                      </Link>
                    </div>
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
