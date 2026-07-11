import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Store, StoreStaffSchedule } from "@/lib/types";

type SearchParams = Promise<{ month?: string }>;

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
  if (profile.role === "staff" && !profile.store_id) {
    return (
      <section className="panel">
        <h1>Store belum di-set</h1>
        <p className="muted">Akun Anda belum terhubung ke store. Hubungi admin untuk mengatur store.</p>
      </section>
    );
  }

  const params = await searchParams;
  const selectedMonth = params.month ?? currentMonthJakarta();
  const monthDates = getMonthDates(selectedMonth);
  const monthStart = monthDates[0];
  const monthEnd = monthDates[monthDates.length - 1];

  const staffStoreId = profile.role === "staff" ? profile.store_id : null;

  const storesQuery = supabase.from("stores").select("*").eq("is_active", true).order("name");
  const staffQuery = supabase.from("profiles").select("*, stores(*)").eq("role", "staff").order("full_name");
  const scheduleQuery = supabase.from("store_staff_schedules").select("*").gte("work_date", monthStart).lte("work_date", monthEnd);

  if (staffStoreId) {
    storesQuery.eq("id", staffStoreId);
    staffQuery.eq("store_id", staffStoreId);
    scheduleQuery.eq("store_id", staffStoreId);
  }

  const [{ data: stores }, { data: staffRows }, { data: scheduleRows }] = await Promise.all([
    storesQuery.returns<Store[]>(),
    staffQuery.returns<StaffWithStore[]>(),
    scheduleQuery.returns<StoreStaffSchedule[]>(),
  ]);

  const scheduleMap = new Map((scheduleRows ?? []).map((schedule) => [`${schedule.staff_id}:${schedule.work_date}`, schedule]));

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
          <p className="muted">
            {staffStoreId ? "Schedule seluruh staff di store Anda dalam satu halaman." : "Schedule seluruh staff dari semua outlet dalam satu halaman."}
          </p>
        </div>
      </div>

      <section className="panel filter-panel">
        <form className="filter-grid">
          <div className="field">
            <label>Bulan</label>
            <input defaultValue={selectedMonth} name="month" type="month" />
          </div>
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
                  {monthDates.map((date) => (
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
                    {monthDates.map((date) => {
                      const schedule = scheduleMap.get(`${staff.id}:${date}`);
                      const note = schedule?.notes?.trim();
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
