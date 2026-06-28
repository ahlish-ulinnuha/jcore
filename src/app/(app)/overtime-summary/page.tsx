import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Store, StoreStaffSchedule } from "@/lib/types";

type SearchParams = Promise<{
  month?: string;
  store?: string;
}>;

type StaffWithStore = Profile & {
  stores?: Store | null;
};

const overtimeHoursByShift: Record<string, number> = {
  F: 4,
  MF: 2,
  MFP: 2,
};

const overtimeRate = 5500;

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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    currency: "IDR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function capitalizeWords(value: string) {
  return value
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function staffStoreCode(staff: StaffWithStore) {
  return staff.stores?.code || staff.stores?.name || staff.store_name || "No Store";
}

function countShift(schedules: StoreStaffSchedule[], code: string) {
  return schedules.filter((schedule) => schedule.shift_code === code).length;
}

export default async function OvertimeSummaryPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile || profile.role !== "admin") redirect("/dashboard");

  const params = await searchParams;
  const selectedMonth = params.month ?? currentMonthJakarta();
  const selectedStoreId = params.store ?? "all";
  const monthDates = getMonthDates(selectedMonth);
  const monthStart = monthDates[0];
  const monthEnd = monthDates[monthDates.length - 1];

  const { data: stores } = await supabase.from("stores").select("*").eq("is_active", true).order("name").returns<Store[]>();

  const staffQuery = supabase.from("profiles").select("*, stores(*)").eq("role", "staff").order("full_name");
  if (selectedStoreId !== "all") staffQuery.eq("store_id", selectedStoreId);
  const { data: staffRows } = await staffQuery.returns<StaffWithStore[]>();

  const scheduleQuery = supabase
    .from("store_staff_schedules")
    .select("*")
    .gte("work_date", monthStart)
    .lte("work_date", monthEnd);
  if (selectedStoreId !== "all") scheduleQuery.eq("store_id", selectedStoreId);
  const { data: scheduleRows } = await scheduleQuery.returns<StoreStaffSchedule[]>();

  const scheduleMap = new Map((scheduleRows ?? []).map((schedule) => [`${schedule.staff_id}:${schedule.work_date}`, schedule]));
  const schedulesByStaff = new Map<string, StoreStaffSchedule[]>();
  for (const schedule of scheduleRows ?? []) {
    const rows = schedulesByStaff.get(schedule.staff_id) ?? [];
    rows.push(schedule);
    schedulesByStaff.set(schedule.staff_id, rows);
  }

  const staffSummaries = (staffRows ?? []).map((staff) => {
    const staffSchedules = schedulesByStaff.get(staff.id) ?? [];
    const fCount = countShift(staffSchedules, "F");
    const mfCount = countShift(staffSchedules, "MF");
    const mfpCount = countShift(staffSchedules, "MFP");
    const overtimeHours = fCount * overtimeHoursByShift.F + mfCount * overtimeHoursByShift.MF + mfpCount * overtimeHoursByShift.MFP;
    return {
      fCount,
      mfCount,
      mfpCount,
      overtimeAmount: overtimeHours * overtimeRate,
      overtimeHours,
      staff,
    };
  });

  const totalsByStore = new Map<string, { amount: number; code: string; hours: number; name: string }>();
  let totalHours = 0;
  let totalAmount = 0;
  for (const summary of staffSummaries) {
    const storeId = summary.staff.store_id ?? "no-store";
    const current = totalsByStore.get(storeId) ?? {
      amount: 0,
      code: staffStoreCode(summary.staff),
      hours: 0,
      name: summary.staff.stores?.name ?? summary.staff.store_name ?? "No Store",
    };
    current.hours += summary.overtimeHours;
    current.amount += summary.overtimeAmount;
    totalsByStore.set(storeId, current);
    totalHours += summary.overtimeHours;
    totalAmount += summary.overtimeAmount;
  }

  const resetParams = new URLSearchParams();
  resetParams.set("month", currentMonthJakarta());
  resetParams.set("store", "all");

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Operasional</p>
          <h1>Overtime Summary</h1>
          <p className="muted">Ringkasan lembur bulanan dari schedule staff.</p>
        </div>
      </div>

      <section className="panel filter-panel">
        <form className="filter-grid">
          <div className="field">
            <label>Bulan</label>
            <input name="month" type="month" defaultValue={selectedMonth} />
          </div>
          <div className="field">
            <label>Store</label>
            <select name="store" defaultValue={selectedStoreId}>
              <option value="all">All Store</option>
              {(stores ?? []).map((store) => (
                <option key={store.id} value={store.id}>
                  {store.code ? `${store.code} - ${store.name}` : store.name}
                </option>
              ))}
            </select>
          </div>
          <button className="button primary" type="submit">
            Tampilkan
          </button>
          <Link className="button outline" href={`/overtime-summary?${resetParams}`}>
            Reset
          </Link>
        </form>
      </section>

      <section className="overtime-summary-cards">
        <div className="panel overtime-summary-card total">
          <span>{selectedStoreId === "all" ? "All Store" : "Total Store"}</span>
          <strong>{totalHours} jam</strong>
          <p>{formatCurrency(totalAmount)}</p>
        </div>
        {(selectedStoreId === "all" ? Array.from(totalsByStore.values()) : Array.from(totalsByStore.values()).slice(0, 1)).map((store) => (
          <div className="panel overtime-summary-card" key={store.code}>
            <span>{store.code}</span>
            <strong>{store.hours} jam</strong>
            <p>{formatCurrency(store.amount)}</p>
          </div>
        ))}
      </section>

      <section className="panel overtime-table-panel">
        <div className="page-head compact">
          <div>
            <p className="eyebrow">{selectedMonth}</p>
            <h2>List Schedule Staff</h2>
          </div>
        </div>
        <div className="table-wrap overtime-table-wrap">
          <table className="overtime-table">
            <thead>
              <tr>
                <th>Staff - Store</th>
                {monthDates.map((date) => (
                  <th key={date}>{date.slice(8)}</th>
                ))}
                <th>F</th>
                <th>MF</th>
                <th>MFP</th>
                <th>Total Overtime (Jam)</th>
                <th>Total Overtime (Rp)</th>
              </tr>
            </thead>
            <tbody>
              {staffSummaries.length ? (
                staffSummaries.map((summary) => (
                  <tr key={summary.staff.id}>
                    <th>{capitalizeWords(summary.staff.full_name)} - {staffStoreCode(summary.staff)}</th>
                    {monthDates.map((date) => (
                      <td key={date}>{scheduleMap.get(`${summary.staff.id}:${date}`)?.shift_code ?? "-"}</td>
                    ))}
                    <td>{summary.fCount}</td>
                    <td>{summary.mfCount}</td>
                    <td>{summary.mfpCount}</td>
                    <td>{summary.overtimeHours}</td>
                    <td>{formatCurrency(summary.overtimeAmount)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={monthDates.length + 6}>Belum ada staff atau schedule pada filter ini.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
