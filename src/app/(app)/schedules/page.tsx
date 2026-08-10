import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, ShiftType, Store, StoreScheduleMonth, StoreStaffSchedule } from "@/lib/types";
import { approveMonthlySchedule, createStaffScheduleRequest, saveMonthlySchedule } from "./actions";
import { ScheduleSubmitButton } from "./ScheduleSubmitButton";

type SearchParams = Promise<{
  approved?: string;
  error?: string;
  history_page?: string;
  history_page_size?: string;
  month?: string;
  requested?: string;
  reviewed?: string;
  saved?: string;
  store?: string;
  week?: string;
}>;

type ScheduleActivityLog = {
  id: string;
  action: "save_draft" | "submit" | "approve";
  actor_name: string | null;
  created_at: string;
  date_from: string | null;
  date_to: string | null;
  summary: string | null;
  week_no: number | null;
};

type ScheduleChangeLog = {
  id: string;
  action: "create" | "update" | "delete";
  actor_name: string | null;
  created_at: string;
  new_notes: string | null;
  new_shift_code: string | null;
  old_notes: string | null;
  old_shift_code: string | null;
  staff_name: string | null;
  work_date: string;
};

type StaffScheduleRequest = {
  id: string;
  notes: string | null;
  profiles?: { full_name?: string | null } | null;
  request_date: string;
  shift_code: string;
  status: "pending" | "approved" | "rejected";
  store_id: string;
};

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

function capitalizeWords(value: string) {
  return value
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function scheduleMonthDate(month: string) {
  return `${month}-01`;
}

function calendarDate(dateValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function addMonths(month: string, offset: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthOptionLabel(month: string) {
  const date = calendarDate(`${month}-01`);
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(date);
}

function staffMonthOptions(selectedMonth: string) {
  return Array.from(new Set(Array.from({ length: 13 }, (_, index) => addMonths(selectedMonth, index - 6))));
}

function getMonthDates(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const days = new Date(year, monthNumber, 0).getDate();
  return Array.from({ length: days }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    return `${month}-${day}`;
  });
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

function completeWeekDates(weekDates: string[]) {
  if (weekDates.length >= 7 || weekDates.length === 0) return weekDates;
  const dates = [...weekDates];
  while (dates.length < 7) {
    dates.push(addDays(dates[dates.length - 1], 1));
  }
  return dates;
}

function outsideMonthLabel(dateValue: string, selectedMonth: string) {
  if (dateValue.slice(0, 7) < selectedMonth) return "Previous";
  if (dateValue.slice(0, 7) > selectedMonth) return "Next";
  return null;
}

function dayLabel(dateValue: string) {
  const date = calendarDate(dateValue);
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    timeZone: "UTC",
    weekday: "short",
  }).format(date);
}

function fullDateLabel(dateValue: string) {
  const date = calendarDate(dateValue);
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
    weekday: "short",
  }).format(date);
}

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

function formatTime(value: string) {
  return value.slice(0, 5).replace(":", ".");
}

function shiftTimeLabel(shift: ShiftType) {
  if (shift.code === "SP") return ": 09.30 - 12.30 / 18.00 - 22.00";
  if (shift.start_time.startsWith("00:00") && shift.end_time.startsWith("00:00")) return "";
  return `: ${formatTime(shift.start_time)} - ${formatTime(shift.end_time)}`;
}

function statusLabel(status?: string) {
  if (status === "approved") return "Approved";
  if (status === "pending_approval") return "Menunggu approval";
  return "Draft";
}

function actionLabel(action: ScheduleActivityLog["action"]) {
  if (action === "approve") return "Approve";
  if (action === "submit") return "Submit Approval";
  return "Simpan Draft";
}

function changeActionLabel(action: ScheduleChangeLog["action"]) {
  if (action === "create") return "Tambah";
  if (action === "delete") return "Hapus";
  return "Ubah";
}

export default async function SchedulesPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile || profile.role === "vendor") redirect("/dashboard");

  const params = await searchParams;
  const selectedMonth = params.month ?? currentMonthJakarta();
  const staffMonthSelectOptions = staffMonthOptions(selectedMonth);
  const monthDates = getMonthDates(selectedMonth);
  const weekGroups = getWeekGroups(selectedMonth);
  const selectedWeek = Math.min(Math.max(1, Number(params.week ?? 1) || 1), weekGroups.length || 1);
  const editableDates = profile.role === "staff" ? monthDates : (weekGroups[selectedWeek - 1] ?? monthDates.slice(0, 7)).filter((date) => date.slice(0, 7) === selectedMonth);
  const dates = profile.role === "staff" ? monthDates : weekGroups[selectedWeek - 1] ?? monthDates.slice(0, 7);
  const monthStart = monthDates[0];
  const monthEnd = monthDates[monthDates.length - 1];
  const visibleScheduleStart = profile.role === "staff" ? weekGroups[0]?.[0] ?? monthStart : monthStart;
  const visibleScheduleEnd = profile.role === "staff" ? weekGroups[weekGroups.length - 1]?.[6] ?? monthEnd : monthEnd;
  const monthHolidays = monthDates
    .map((date) => ({ date, name: indonesiaPublicHolidays[date] }))
    .filter((item): item is { date: string; name: string } => Boolean(item.name));
  const historyPageSizeOptions = [10, 20, 50, 100];
  const requestedHistoryPageSize = Number(params.history_page_size ?? 10);
  const historyPageSize = historyPageSizeOptions.includes(requestedHistoryPageSize) ? requestedHistoryPageSize : 10;
  const historyPage = Math.max(1, Number(params.history_page ?? 1) || 1);
  const historyRangeFrom = (historyPage - 1) * historyPageSize;
  const historyRangeTo = historyRangeFrom + historyPageSize - 1;

  const [{ data: allStores }, { data: shiftTypes }] = await Promise.all([
    supabase.from("stores").select("*").eq("is_active", true).order("name").returns<Store[]>(),
    supabase.from("shift_types").select("*").eq("is_active", true).order("sort_order").returns<ShiftType[]>(),
  ]);
  const stores = (allStores ?? []).filter((store) => store.name.trim().toLowerCase() !== "all store");

  const selectedStoreId = profile.role === "staff" ? profile.store_id ?? "" : params.store ?? stores?.[0]?.id ?? "";
  const { data: staffRows } = selectedStoreId
    ? profile.role === "staff"
      ? await supabase.from("profiles").select("*").eq("id", profile.id).returns<Profile[]>()
      : await supabase
          .from("profiles")
          .select("*")
          .eq("role", "staff")
          .eq("store_id", selectedStoreId)
          .order("full_name")
          .returns<Profile[]>()
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
        .gte("work_date", visibleScheduleStart)
        .lte("work_date", visibleScheduleEnd)
        .returns<StoreStaffSchedule[]>()
    : { data: [] as StoreStaffSchedule[] };

  const { data: activityLogs } = scheduleMonth?.id
    ? await supabase
        .from("store_schedule_activity_logs")
        .select("*")
        .eq("schedule_month_id", scheduleMonth.id)
        .order("created_at", { ascending: false })
        .limit(20)
        .returns<ScheduleActivityLog[]>()
    : { data: [] as ScheduleActivityLog[] };
  const { data: changeLogs, count: changeLogCount } = scheduleMonth?.id
    ? await supabase
        .from("store_schedule_change_logs")
        .select("*", { count: "exact" })
        .eq("schedule_month_id", scheduleMonth.id)
        .order("created_at", { ascending: false })
        .range(historyRangeFrom, historyRangeTo)
        .returns<ScheduleChangeLog[]>()
    : { data: [] as ScheduleChangeLog[], count: 0 };
  const scheduleRequestsQuery = profile.role === "staff"
      ? supabase
          .from("staff_schedule_requests")
          .select("*")
          .eq("staff_id", profile.id)
          .gte("request_date", monthStart)
          .lte("request_date", monthEnd)
          .order("created_at", { ascending: false })
      : null;

  const { data: scheduleRequests } = scheduleRequestsQuery
    ? await scheduleRequestsQuery.returns<StaffScheduleRequest[]>()
    : { data: [] as StaffScheduleRequest[] };

  const scheduleMap = new Map((scheduleRows ?? []).map((row) => [`${row.staff_id}:${row.work_date}`, row]));
  const selectedStore = stores?.find((store) => store.id === selectedStoreId);
  const resetParams = new URLSearchParams();
  if (profile.role === "staff") {
    if (selectedStoreId) resetParams.set("store", selectedStoreId);
  } else if (stores?.[0]?.id) {
    resetParams.set("store", stores[0].id);
  }
  resetParams.set("month", currentMonthJakarta());
  resetParams.set("week", "1");
  const historyTotalPages = Math.max(1, Math.ceil((changeLogCount ?? 0) / historyPageSize));
  const activeHistoryPage = Math.min(historyPage, historyTotalPages);
  const historyBaseParams = new URLSearchParams();
  if (selectedStoreId) historyBaseParams.set("store", selectedStoreId);
  historyBaseParams.set("month", selectedMonth);
  historyBaseParams.set("week", String(selectedWeek));
  historyBaseParams.set("history_page_size", String(historyPageSize));
  const previousHistoryParams = new URLSearchParams(historyBaseParams);
  previousHistoryParams.set("history_page", String(Math.max(1, activeHistoryPage - 1)));
  const nextHistoryParams = new URLSearchParams(historyBaseParams);
  nextHistoryParams.set("history_page", String(Math.min(historyTotalPages, activeHistoryPage + 1)));

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Schedule toko</p>
          <h1>Schedule</h1>
          <p className="muted"></p>
        </div>        
      </div>

      {params.saved === "1" ? <div className="toast submit">Schedule berhasil disimpan.</div> : null}
      {params.approved === "1" ? <div className="toast submit">Schedule berhasil diapprove.</div> : null}
      {params.requested === "1" ? <div className="toast submit">Request schedule berhasil dikirim.</div> : null}
      {params.reviewed === "1" ? <div className="toast submit">Request schedule berhasil diproses.</div> : null}
      {params.error === "missing-filter" ? <div className="toast delete">Store dan bulan wajib dipilih.</div> : null}

      {profile.role === "admin" ? (
        <>
          <section className="panel schedule-shift-panel">
            <div className="table-wrap compact-mobile-wrap">
              <table className="compact-mobile-table schedule-shift-table">
                <thead>
                  <tr>
                    <th>Shift</th>
                    <th>Deskripsi</th>
                    <th>Jam</th>
                  </tr>
                </thead>
                <tbody>
                  {(shiftTypes ?? []).map((shift) => (
                    <tr key={shift.code}>
                      <td>
                        <strong>{shift.code}</strong>
                      </td>
                      <td>{shift.name}</td>
                      <td>{shiftTimeLabel(shift).replace(/^: /, "") || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <br />
        </>
      ) : null}
      <section className="panel filter-panel">
        <form className="filter-grid">
          {profile.role === "staff" ? (
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
            <label>{profile.role === "staff" ? "Pilih Bulan" : "Bulan"}</label>
            {profile.role === "staff" ? (
              <select className="month-picker-input" name="month" defaultValue={selectedMonth}>
                {staffMonthSelectOptions.map((month) => (
                  <option key={month} value={month}>
                    {monthOptionLabel(month)}
                  </option>
                ))}
              </select>
            ) : (
              <input name="month" type="month" defaultValue={selectedMonth} />
            )}
          </div>
          {profile.role === "admin" ? (
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
          ) : null}
          <ScheduleSubmitButton idleText="Tampilkan" pendingText="Sedang menampilkan..." />
          <Link className="button outline" href={`/schedules?${resetParams}`}>
            Reset
          </Link>
        </form>
      </section>

      <section className="panel schedule-holiday-panel">
        <div className="page-head compact">
          <div>
            <p className="eyebrow"></p>
            <h2>Info Libur Nasional {selectedMonth}</h2>
          </div>
        </div>
        {monthHolidays.length ? (
          <div className="table-wrap compact-mobile-wrap">
            <table className="compact-mobile-table schedule-holiday-table">
              <thead>
                <tr>
                  <th>Hari</th>
                  <th>Deskripsi</th>
                </tr>
              </thead>
              <tbody>
                {monthHolidays.map((holiday) => (
                  <tr key={holiday.date}>
                    <td>{fullDateLabel(holiday.date)}</td>
                    <td>{holiday.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">Tidak ada tanggal merah nasional di bulan ini.</p>
        )}
      </section>
      <br/>

      {profile.role === "admin" ? <div className={`schedule-status ${scheduleMonth?.status ?? "draft"}`}>{statusLabel(scheduleMonth?.status)}</div> : null}
      <section className="panel schedule-board-panel">
        <div className="page-head compact">
          <div>
            <p className="eyebrow"></p>
            <h2>
              {profile.role === "staff" ? "My Schedule" : "Schedule"} {selectedMonth} - {profile.role === "staff" ? capitalizeWords(profile.full_name) : selectedStore?.name ?? profile.store_name ?? "Toko"}
              {profile.role === "admin" ? ` - Week ${selectedWeek}` : ""}
            </h2>
          </div>
          {scheduleMonth && profile.role === "admin" ? (
            <form action={approveMonthlySchedule}>
              <input name="schedule_id" type="hidden" value={scheduleMonth.id} />
              <input name="store_id" type="hidden" value={selectedStoreId} />
              <input name="month" type="hidden" value={selectedMonth} />
              <input name="week_no" type="hidden" value={selectedWeek} />
              <input name="date_from" type="hidden" value={editableDates[0] ?? ""} />
              <input name="date_to" type="hidden" value={editableDates[editableDates.length - 1] ?? ""} />
              <ScheduleSubmitButton disabled={scheduleMonth.status === "approved"} idleText={scheduleMonth.status === "approved" ? "Approved" : "Approve"} pendingText="Sedang approve..." />
            </form>
          ) : null}
        </div>

        {profile.role === "staff" && scheduleMonth && scheduleMonth.status !== "approved" ? (
          <p className="muted">Schedule bulan ini sudah diinput tapi masih menunggu approval admin.</p>
        ) : null}

        {staffRows?.length && profile.role === "admin" ? (
          <form action={saveMonthlySchedule}>
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
                                  name={`notes_${staff.id}_${date}`}
                                  defaultValue={value?.notes ?? ""}
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
              <ScheduleSubmitButton idleText="Submit" name="intent" pendingText="Sedang submit..." value="submit" />
            </div>
          </form>
        ) : (
          staffRows?.length ? (
            <div className="staff-calendar-month">
              {weekGroups.map((weekDates, weekIndex) => (
                <section className="staff-calendar-week" key={weekIndex + 1}>
                  <div className="staff-calendar-week-title">Week {weekIndex + 1}</div>
                  <div className="staff-calendar-days">
                    {completeWeekDates(weekDates).map((date) => {
                      const meta = dayMeta(date);
                      const readonlyLabel = outsideMonthLabel(date, selectedMonth);
                      const isApprovedMonth = date.slice(0, 7) === selectedMonth ? scheduleMonth?.status === "approved" : true;
                      const value = isApprovedMonth ? scheduleMap.get(`${profile.id}:${date}`) : undefined;
                      return (
                        <div className={[meta.className, readonlyLabel ? "readonly-info" : "", "staff-calendar-day"].filter(Boolean).join(" ")} key={date} title={meta.holidayName ?? undefined}>
                          <span>{dayLabel(date)}</span>
                          {readonlyLabel ? (
                            <>
                              <small className="next-month-label">{readonlyLabel}</small>
                              <strong>{value?.shift_code ?? "-"}</strong>
                              {value?.notes ? <small className="schedule-note">Note: {value.notes}</small> : null}
                            </>
                          ) : (
                            <>
                              <strong>{value?.shift_code ?? "-"}</strong>
                              {value?.notes ? <small className="schedule-note">Note: {value.notes}</small> : null}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="alert">Belum ada staff aktif di store ini. Set store user staff terlebih dahulu di Master Data User.</div>
          )
        )}
      </section>

      {profile.role === "staff" ? <section className="panel schedule-request-panel">
        <div className="page-head compact">
          <div>
            <p className="eyebrow">Request schedule</p>
            <h2>Ajukan schedule</h2>
          </div>
        </div>
        <form action={createStaffScheduleRequest} className="filter-grid">
          <input name="month" type="hidden" value={selectedMonth} />
          <div className="field">
            <label>Tanggal</label>
            <input name="request_date" type="date" required />
          </div>
          <div className="field">
            <label>Schedule</label>
            <select name="shift_code" required>
              <option value="">Pilih schedule</option>
              {(shiftTypes ?? []).map((shift) => (
                <option key={shift.code} value={shift.code}>
                  {shift.code} - {shift.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Catatan</label>
            <input name="notes" placeholder="Opsional" />
          </div>
          <ScheduleSubmitButton idleText="Kirim Request" pendingText="Sedang mengirim..." />
          </form>
        {scheduleRequests?.length ? (
          <div className="table-wrap compact-mobile-wrap schedule-request-table-wrap">
            <table className="compact-mobile-table schedule-request-table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Schedule</th>
                  <th>Status</th>
                  <th>Catatan</th>
                </tr>
              </thead>
              <tbody>
                {scheduleRequests.map((request) => (
                  <tr key={request.id}>
                    <td>{fullDateLabel(request.request_date)}</td>
                    <td>{request.shift_code}</td>
                    <td>
                      <span className={`badge ${request.status}`}>{request.status}</span>
                    </td>
                    <td>{request.notes ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">Belum ada request schedule.</p>
        )}
      </section> : null}

      {profile.role === "admin" ? <section className="panel schedule-history-panel">
        <div className="page-head compact">
          <div>
            <p className="eyebrow">History</p>
            <h2>Riwayat perubahan schedule</h2>
          </div>
        </div>
        {activityLogs?.length ? (
          <div className="schedule-history-list">
            {activityLogs.map((log) => (
              <div className="schedule-history-item" key={log.id}>
                <div>
                  <strong>{actionLabel(log.action)}</strong>
                  <p>{log.summary ?? "-"}</p>
                </div>
                <span>
                  {log.week_no ? `Week ${log.week_no}` : "Bulanan"}
                  {log.date_from && log.date_to ? ` • ${fullDateLabel(log.date_from)} - ${fullDateLabel(log.date_to)}` : ""}
                  {" • "}
                  {new Date(log.created_at).toLocaleString("id-ID", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                  {log.actor_name ? ` • ${log.actor_name}` : ""}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">Belum ada history perubahan schedule.</p>
        )}
        <div className="schedule-change-history">
          <h3>Detail perubahan</h3>
          <form className="filter-grid schedule-history-filter">
            <input name="store" type="hidden" value={selectedStoreId} />
            <input name="month" type="hidden" value={selectedMonth} />
            <input name="week" type="hidden" value={selectedWeek} />
            <input name="history_page" type="hidden" value="1" />
            <div className="field">
              <label>Data per halaman</label>
              <select name="history_page_size" defaultValue={historyPageSize}>
                {historyPageSizeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option} row
                  </option>
                ))}
              </select>
            </div>
            <ScheduleSubmitButton idleText="Tampilkan History" pendingText="Sedang menampilkan..." />
          </form>
          {changeLogs?.length ? (
            <>
              <div className="table-wrap compact-mobile-wrap">
                <table className="compact-mobile-table schedule-change-table">
                  <thead>
                    <tr>
                      <th>Waktu</th>
                      <th>Staff</th>
                      <th>Tanggal</th>
                      <th>Aksi</th>
                      <th>Shift</th>
                      <th>Note</th>
                      <th>Admin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {changeLogs.map((log) => (
                      <tr key={log.id}>
                        <td>
                          {new Date(log.created_at).toLocaleString("id-ID", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </td>
                        <td>{log.staff_name ?? "-"}</td>
                        <td>{fullDateLabel(log.work_date)}</td>
                        <td>{changeActionLabel(log.action)}</td>
                        <td>
                          {(log.old_shift_code ?? "-")} → {(log.new_shift_code ?? "-")}
                        </td>
                        <td>
                          {(log.old_notes ?? "-")} → {(log.new_notes ?? "-")}
                        </td>
                        <td>{log.actor_name ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="pagination">
                <Link
                  aria-label="Halaman history sebelumnya"
                  className={`button outline ${activeHistoryPage <= 1 ? "disabled-link" : ""}`}
                  href={`/schedules?${previousHistoryParams}`}
                >
                  ‹
                </Link>
                <span className="muted">
                  {activeHistoryPage} / {historyTotalPages} ({changeLogCount ?? 0} data)
                </span>
                <Link
                  aria-label="Halaman history berikutnya"
                  className={`button outline ${activeHistoryPage >= historyTotalPages ? "disabled-link" : ""}`}
                  href={`/schedules?${nextHistoryParams}`}
                >
                  ›
                </Link>
              </div>
            </>
          ) : (
            <p className="muted">Belum ada detail perubahan.</p>
          )}
        </div>
      </section> : null}
    </>
  );
}
