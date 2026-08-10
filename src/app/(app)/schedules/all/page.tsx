import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Store, StoreStaffSchedule } from "@/lib/types";

type SearchParams = Promise<{ month?: string; view?: string; week?: string }>;

type StaffWithStore = Profile & {
  stores?: Store | null;
};

type StoreGroup = {
  staff: StaffWithStore[];
  storeId: string;
  storeName: string;
};

function currentMonthJakarta() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    month: "2-digit",
    timeZone: "Asia/Jakarta",
    year: "numeric",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? String(new Date().getFullYear());
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  return `${year}-${month}`;
}

function getMonthDates(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const days = new Date(year, monthNumber, 0).getDate();
  return Array.from({ length: days }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`);
}

function calendarDate(dateValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(dateValue: string, days: number) {
  const date = calendarDate(dateValue);
  date.setUTCDate(date.getUTCDate() + days);
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
    year: "numeric",
  }).format(date);
}

function getWeekGroups(month: string) {
  const dates = getMonthDates(month);
  const firstDate = calendarDate(dates[0]);
  const firstDay = firstDate.getUTCDay();
  const mondayOffset = firstDay === 0 ? -6 : 1 - firstDay;
  const calendarStart = addDays(dates[0], mondayOffset);
  const lastDate = calendarDate(dates[dates.length - 1]);
  const lastDay = lastDate.getUTCDay();
  const sundayOffset = lastDay === 0 ? 0 : 7 - lastDay;
  const calendarEnd = addDays(dates[dates.length - 1], sundayOffset);
  const groups: string[][] = [];
  let cursor = calendarStart;
  let currentWeek: string[] = [];

  while (cursor <= calendarEnd) {
    currentWeek.push(cursor);
    if (currentWeek.length === 7) {
      groups.push(currentWeek);
      currentWeek = [];
    }
    cursor = addDays(cursor, 1);
  }

  return groups;
}

function dayName(date: string) {
  return new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", weekday: "short" }).format(new Date(`${date}T00:00:00+07:00`));
}

function capitalizeWords(value: string) {
  return value
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default async function AllSchedulesPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile || profile.role === "vendor") redirect("/dashboard");

  const params = await searchParams;
  const selectedMonth = params.month ?? currentMonthJakarta();
  const monthDates = getMonthDates(selectedMonth);
  const viewMode = params.view === "week" ? "week" : "month";
  const weekGroups = getWeekGroups(selectedMonth);
  const selectedWeek = Math.min(Math.max(1, Number(params.week ?? 1) || 1), weekGroups.length || 1);
  const weekDates = weekGroups[selectedWeek - 1] ?? monthDates.slice(0, 7);
  const displayDates = viewMode === "week" ? weekDates : monthDates;
  const queryStart = viewMode === "week" ? weekDates[0] : monthDates[0];
  const queryEnd = viewMode === "week" ? weekDates[weekDates.length - 1] : monthDates[monthDates.length - 1];

  const monthsInRange = Array.from(new Set([queryStart.slice(0, 7), queryEnd.slice(0, 7)])).map((month) => `${month}-01`);

  const [{ data: stores }, { data: staffRows }, { data: scheduleRows }, { data: scheduleMonths }] = await Promise.all([
    supabase.from("stores").select("*").eq("is_active", true).order("name").returns<Store[]>(),
    supabase.from("profiles").select("*, stores(*)").eq("role", "staff").order("full_name").returns<StaffWithStore[]>(),
    supabase.from("store_staff_schedules").select("*").gte("work_date", queryStart).lte("work_date", queryEnd).returns<StoreStaffSchedule[]>(),
    supabase.from("store_schedule_months").select("store_id, schedule_month, status").in("schedule_month", monthsInRange),
  ]);

  const approvedMonths = new Set(
    (scheduleMonths ?? []).filter((month) => month.status === "approved").map((month) => `${month.store_id}:${month.schedule_month.slice(0, 7)}`),
  );
  const visibleScheduleRows =
    profile.role === "admin" ? scheduleRows ?? [] : (scheduleRows ?? []).filter((schedule) => approvedMonths.has(`${schedule.store_id}:${schedule.work_date.slice(0, 7)}`));

  const scheduleMap = new Map(visibleScheduleRows.map((schedule) => [`${schedule.staff_id}:${schedule.work_date}`, schedule]));

  const staffByStore = new Map<string, StaffWithStore[]>();
  for (const staff of staffRows ?? []) {
    const key = staff.store_id ?? "no-store";
    const rows = staffByStore.get(key) ?? [];
    rows.push(staff);
    staffByStore.set(key, rows);
  }

  const storeGroups: StoreGroup[] = [
    ...(stores ?? [])
      .map((store) => ({ staff: staffByStore.get(store.id) ?? [], storeId: store.id, storeName: store.name }))
      .filter((group) => group.staff.length > 0),
    ...(staffByStore.has("no-store") ? [{ staff: staffByStore.get("no-store")!, storeId: "no-store", storeName: "Tanpa Store" }] : []),
  ];

  const resetParams = new URLSearchParams();
  resetParams.set("month", currentMonthJakarta());

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Operasional</p>
          <h1>All Schedule</h1>
          <p className="muted">Schedule seluruh staff dari semua outlet dalam satu halaman.</p>
        </div>
      </div>

      <section className="panel filter-panel">
        <form className="filter-grid">
          <div className="field">
            <label>Bulan</label>
            <input defaultValue={selectedMonth} name="month" type="month" />
          </div>
          <div className="field">
            <label>Tampilan</label>
            <select defaultValue={viewMode} name="view">
              <option value="month">Bulanan</option>
              <option value="week">Mingguan</option>
            </select>
          </div>
          {viewMode === "week" ? (
            <div className="field">
              <label>Minggu</label>
              <select defaultValue={selectedWeek} name="week">
                {weekGroups.map((groupDates, index) => (
                  <option key={index + 1} value={index + 1}>
                    Week {index + 1} ({groupDates[0]?.slice(8)}-{groupDates[groupDates.length - 1]?.slice(8)})
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <button className="button primary" type="submit">
            Tampilkan
          </button>
          <Link className="button outline" href={`/schedules/all?${resetParams}`}>
            Reset
          </Link>
        </form>
      </section>

      {storeGroups.map((group) => (
        <section className="panel overtime-table-panel" key={group.storeId} style={{ marginTop: 16 }}>
          <div className="page-head compact">
            <div>
              <p className="eyebrow">Outlet</p>
              <h2>{group.storeName}</h2>
            </div>
          </div>
          <div className="table-wrap overtime-table-wrap">
            <table className="overtime-table">
              <thead>
                <tr>
                  <th>Staff</th>
                  {displayDates.map((date) => (
                    <th key={date}>
                      <div>{date.slice(8)}</div>
                      <div className="overtime-day-name">{dayName(date)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.staff.map((staff) => (
                  <tr key={staff.id}>
                    <th>{capitalizeWords(staff.full_name)}</th>
                    {displayDates.map((date) => {
                      const schedule = scheduleMap.get(`${staff.id}:${date}`);
                      const note = schedule?.notes?.trim();
                      if (viewMode === "week") {
                        return (
                          <td className={note ? "overtime-cell-noted" : undefined} key={date}>
                            <div>{schedule?.shift_code ?? "-"}</div>
                            {note ? <div className="overtime-note-text muted">{note}</div> : null}
                          </td>
                        );
                      }
                      return (
                        <td className={note ? "overtime-cell-noted" : undefined} key={date} title={note || undefined}>
                          {schedule?.shift_code ?? "-"}
                          {note ? <span className="overtime-note-dot" /> : null}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      {storeGroups.length === 0 ? (
        <section className="panel" style={{ marginTop: 16 }}>
          <p className="muted">Belum ada staff atau schedule pada bulan ini.</p>
        </section>
      ) : null}
    </>
  );
}
