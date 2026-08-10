import Link from "next/link";
import { redirect } from "next/navigation";
import { allowedMenuKeysForRole, hasMenuAccess } from "@/lib/menu-access";
import { createClient } from "@/lib/supabase/server";
import type { Profile, ProfileMenuAccess, ShiftType, Store, StoreScheduleMonth, StoreStaffSchedule } from "@/lib/types";
import { saveMonthlySchedule } from "../actions";
import { ScheduleSubmitButton } from "../ScheduleSubmitButton";

type SearchParams = Promise<{
  error?: string;
  month?: string;
  saved?: string;
  store?: string;
  week?: string;
}>;

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

function todayJakarta() {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Jakarta",
    year: "numeric",
  }).format(new Date());
}

function scheduleMonthDate(month: string) {
  return `${month}-01`;
}

function calendarDate(dateValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function getMonthDates(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const days = new Date(year, monthNumber, 0).getDate();
  return Array.from({ length: days }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`);
}

function addDays(dateValue: string, days: number) {
  const date = calendarDate(dateValue);
  date.setUTCDate(date.getUTCDate() + days);
  return new Intl.DateTimeFormat("en-CA", { day: "2-digit", month: "2-digit", timeZone: "UTC", year: "numeric" }).format(date);
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

function outsideMonthLabel(dateValue: string, selectedMonth: string) {
  if (dateValue.slice(0, 7) < selectedMonth) return "Previous";
  if (dateValue.slice(0, 7) > selectedMonth) return "Next";
  return null;
}

function dayLabel(dateValue: string) {
  const date = calendarDate(dateValue);
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", timeZone: "UTC", weekday: "short" }).format(date);
}

const indonesiaPublicHolidays: Record<string, string> = {
  "2026-01-01": "Tahun Baru Masehi",
  "2026-01-16": "Isra Miraj",
  "2026-02-17": "Tahun Baru Imlek",
  "2026-03-19": "Hari Suci Nyepi",
  "2026-03-21": "Idul Fitri",
  "2026-03-22": "Idul Fitri",
  "2026-04-03": "Wafat Yesus Kristus",
  "2026-04-05": "Paskah",
  "2026-05-01": "Hari Buruh",
  "2026-05-14": "Kenaikan Yesus Kristus",
  "2026-05-27": "Idul Adha",
  "2026-05-31": "Hari Raya Waisak",
  "2026-06-01": "Hari Lahir Pancasila",
  "2026-06-16": "Tahun Baru Islam",
  "2026-08-17": "Hari Kemerdekaan RI",
  "2026-08-25": "Maulid Nabi Muhammad SAW",
  "2026-12-25": "Hari Raya Natal",
};

function dayMeta(dateValue: string) {
  const date = calendarDate(dateValue);
  const day = date.getUTCDay();
  const holidayName = indonesiaPublicHolidays[dateValue];
  const isToday = dateValue === todayJakarta();
  return {
    className: [day === 0 || day === 6 ? "weekend" : "", holidayName ? "holiday" : "", isToday ? "today" : ""].filter(Boolean).join(" "),
    holidayName,
  };
}

function statusLabel(status?: string) {
  if (status === "approved") return "Approved";
  if (status === "pending_approval") return "Menunggu approval";
  return "Draft";
}

export default async function InputSchedulePage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile || profile.role === "vendor") redirect("/dashboard");

  const { data: menuAccessRows } = await supabase
    .from("profile_menu_access")
    .select("*")
    .eq("profile_id", profile.id)
    .returns<ProfileMenuAccess[]>();
  const allowedMenuKeys = allowedMenuKeysForRole(profile.role, menuAccessRows ?? []);
  const canPickAnyStore = profile.role === "admin" || hasMenuAccess("input_schedule_all_store", allowedMenuKeys);
  const canInputSchedule = canPickAnyStore || hasMenuAccess("input_schedule", allowedMenuKeys);
  if (!canInputSchedule) redirect("/dashboard");

  const params = await searchParams;
  const selectedMonth = params.month ?? currentMonthJakarta();
  const monthDates = getMonthDates(selectedMonth);
  const weekGroups = getWeekGroups(selectedMonth);
  const selectedWeek = Math.min(Math.max(1, Number(params.week ?? 1) || 1), weekGroups.length || 1);
  const dates = weekGroups[selectedWeek - 1] ?? monthDates.slice(0, 7);
  const editableDates = dates.filter((date) => date.slice(0, 7) === selectedMonth);

  const { data: allStores } = await supabase.from("stores").select("*").eq("is_active", true).order("name").returns<Store[]>();
  const stores = (allStores ?? []).filter((store) => store.name.trim().toLowerCase() !== "all store");
  const { data: shiftTypes } = await supabase.from("shift_types").select("*").eq("is_active", true).order("sort_order").returns<ShiftType[]>();

  const selectedStoreId = !canPickAnyStore ? profile.store_id ?? "" : params.store ?? stores?.[0]?.id ?? "";
  const selectedStore = stores?.find((store) => store.id === selectedStoreId);

  const { data: staffRows } = selectedStoreId
    ? await supabase.from("profiles").select("*").eq("role", "staff").eq("store_id", selectedStoreId).order("full_name").returns<Profile[]>()
    : { data: [] as Profile[] };

  const { data: scheduleMonth } = selectedStoreId
    ? await supabase
        .from("store_schedule_months")
        .select("*")
        .eq("store_id", selectedStoreId)
        .eq("schedule_month", scheduleMonthDate(selectedMonth))
        .maybeSingle<StoreScheduleMonth>()
    : { data: null };

  const { data: scheduleRows } = selectedStoreId
    ? await supabase
        .from("store_staff_schedules")
        .select("*")
        .eq("store_id", selectedStoreId)
        .gte("work_date", monthDates[0])
        .lte("work_date", monthDates[monthDates.length - 1])
        .returns<StoreStaffSchedule[]>()
    : { data: [] as StoreStaffSchedule[] };

  const scheduleMap = new Map((scheduleRows ?? []).map((row) => [`${row.staff_id}:${row.work_date}`, row]));

  const resetParams = new URLSearchParams();
  if (!canPickAnyStore) {
    if (selectedStoreId) resetParams.set("store", selectedStoreId);
  } else if (stores?.[0]?.id) {
    resetParams.set("store", stores[0].id);
  }
  resetParams.set("month", currentMonthJakarta());
  resetParams.set("week", "1");

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Schedule toko</p>
          <h1>Input Schedule</h1>
          <p className="muted"></p>
        </div>
      </div>

      {params.saved === "1" ? <div className="toast submit">Schedule berhasil disimpan.</div> : null}
      {params.error === "missing-filter" ? <div className="toast delete">Store dan bulan wajib dipilih.</div> : null}

      <section className="panel filter-panel">
        <form className="filter-grid">
          {!canPickAnyStore ? (
            <input name="store" type="hidden" value={selectedStoreId} />
          ) : (
            <div className="field">
              <label>Store</label>
              <select name="store" defaultValue={selectedStoreId}>
                {(stores ?? []).map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="field">
            <label>Bulan</label>
            <input name="month" type="month" defaultValue={selectedMonth} />
          </div>
          <div className="field">
            <label>Minggu</label>
            <select name="week" defaultValue={selectedWeek}>
              {weekGroups.map((weekDates, index) => (
                <option key={index + 1} value={index + 1}>
                  Week {index + 1} ({weekDates[0]?.slice(8)}-{weekDates[weekDates.length - 1]?.slice(8)})
                </option>
              ))}
            </select>
          </div>
          <ScheduleSubmitButton idleText="Tampilkan" pendingText="Sedang menampilkan..." />
          <Link className="button outline" href={`/schedules/input?${resetParams}`}>
            Reset
          </Link>
        </form>
      </section>

      <div className={`schedule-status ${scheduleMonth?.status ?? "draft"}`}>{statusLabel(scheduleMonth?.status)}</div>
      <section className="panel schedule-board-panel">
        <div className="page-head compact">
          <div>
            <p className="eyebrow"></p>
            <h2>
              Schedule {selectedMonth} - {selectedStore?.name ?? profile.store_name ?? "Toko"} - Week {selectedWeek}
            </h2>
          </div>
        </div>

        {staffRows?.length ? (
          <form action={saveMonthlySchedule}>
            <input name="redirect_to" type="hidden" value="/schedules/input" />
            <input name="store_id" type="hidden" value={selectedStoreId} />
            <input name="schedule_month" type="hidden" value={scheduleMonthDate(selectedMonth)} />
            <input name="week_no" type="hidden" value={selectedWeek} />
            {editableDates.map((date) => (
              <input key={date} name="work_date" type="hidden" value={date} />
            ))}
            {(staffRows ?? []).map((staff) => (
              <input key={staff.id} name="staff_id" type="hidden" value={staff.id} />
            ))}

            <div className="schedule-table-wrap">
              <table className="schedule-table">
                <thead>
                  <tr>
                    <th>Staff</th>
                    {dates.map((date) => {
                      const meta = dayMeta(date);
                      return (
                        <th className={meta.className} key={date} title={meta.holidayName ?? undefined}>
                          {dayLabel(date)}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {(staffRows ?? []).map((staff) => (
                    <tr key={staff.id}>
                      <th>
                        <span>{staff.full_name}</span>
                      </th>
                      {dates.map((date) => {
                        const value = scheduleMap.get(`${staff.id}:${date}`);
                        const meta = dayMeta(date);
                        const readonlyLabel = outsideMonthLabel(date, selectedMonth);
                        return (
                          <td className={[meta.className, readonlyLabel ? "readonly-info" : ""].filter(Boolean).join(" ")} key={date} title={meta.holidayName ?? undefined}>
                            {readonlyLabel ? (
                              <div className="schedule-next-month-info">
                                <strong>{readonlyLabel}</strong>
                                <span>{date.slice(5)}</span>
                              </div>
                            ) : (
                              <>
                                <select aria-label={`${staff.full_name} ${date}`} name={`shift_${staff.id}_${date}`} defaultValue={value?.shift_code ?? ""}>
                                  <option value="">-</option>
                                  {(shiftTypes ?? []).map((shift) => (
                                    <option key={shift.code} value={shift.code}>
                                      {shift.code}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  aria-label={`Catatan ${staff.full_name} ${date}`}
                                  defaultValue={value?.notes ?? ""}
                                  name={`notes_${staff.id}_${date}`}
                                  placeholder="Note"
                                />
                              </>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="row-actions schedule-actions">
              <ScheduleSubmitButton className="button outline" idleText="Simpan Draft" name="intent" pendingText="Sedang menyimpan..." value="draft" />
              <ScheduleSubmitButton idleText="Submit Approval" name="intent" pendingText="Sedang submit..." value="submit" />
            </div>
          </form>
        ) : (
          <div className="alert">Belum ada staff aktif di store ini. Set store user staff terlebih dahulu di Master Data User.</div>
        )}
      </section>
    </>
  );
}
