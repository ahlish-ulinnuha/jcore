import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, ShiftType, Store } from "@/lib/types";
import { reviewStaffScheduleRequest } from "../actions";
import { ScheduleSubmitButton } from "../ScheduleSubmitButton";

type SearchParams = Promise<{
  month?: string;
  page?: string;
  page_size?: string;
  reviewed?: string;
  staff?: string;
  store?: string;
}>;

type StaffScheduleRequest = {
  id: string;
  notes: string | null;
  profiles?: { full_name?: string | null } | null;
  request_date: string;
  shift_code: string;
  status: "pending" | "approved" | "rejected";
  store_id: string;
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
  return {
    end: `${month}-${String(days).padStart(2, "0")}`,
    start: `${month}-01`,
  };
}

function fullDateLabel(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00+07:00`);
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    weekday: "short",
  }).format(date);
}

export default async function ScheduleRequestsPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile || profile.role !== "admin") redirect("/dashboard");

  const params = await searchParams;
  const selectedMonth = params.month ?? currentMonthJakarta();
  const { start, end } = getMonthDates(selectedMonth);
  const selectedStoreId = params.store ?? "all";
  const selectedStaffId = params.staff ?? "all";
  const pageSizeOptions = [10, 20, 50, 100];
  const requestedPageSize = Number(params.page_size ?? 10);
  const pageSize = pageSizeOptions.includes(requestedPageSize) ? requestedPageSize : 10;
  const currentPage = Math.max(1, Number(params.page ?? 1) || 1);
  const rangeFrom = (currentPage - 1) * pageSize;
  const rangeTo = rangeFrom + pageSize - 1;

  const [{ data: stores }, { data: shiftTypes }] = await Promise.all([
    supabase.from("stores").select("*").eq("is_active", true).order("name").returns<Store[]>(),
    supabase.from("shift_types").select("*").eq("is_active", true).order("sort_order").returns<ShiftType[]>(),
  ]);

  const staffQuery = supabase.from("profiles").select("*").eq("role", "staff").order("full_name");
  if (selectedStoreId !== "all") staffQuery.eq("store_id", selectedStoreId);
  const { data: staffRows } = await staffQuery.returns<Profile[]>();

  const requestQuery = supabase
    .from("staff_schedule_requests")
    .select("*, profiles:staff_id(full_name)", { count: "exact" })
    .gte("request_date", start)
    .lte("request_date", end)
    .order("created_at", { ascending: false })
    .range(rangeFrom, rangeTo);

  if (selectedStoreId !== "all") requestQuery.eq("store_id", selectedStoreId);
  if (selectedStaffId !== "all") requestQuery.eq("staff_id", selectedStaffId);

  const { data: scheduleRequests, count: requestCount } = await requestQuery.returns<StaffScheduleRequest[]>();
  const shiftMap = new Map((shiftTypes ?? []).map((shift) => [shift.code, shift.name]));
  const totalPages = Math.max(1, Math.ceil((requestCount ?? 0) / pageSize));
  const activePage = Math.min(currentPage, totalPages);
  const paginationParams = new URLSearchParams();
  paginationParams.set("month", selectedMonth);
  paginationParams.set("store", selectedStoreId);
  paginationParams.set("staff", selectedStaffId);
  paginationParams.set("page_size", String(pageSize));
  const previousParams = new URLSearchParams(paginationParams);
  previousParams.set("page", String(Math.max(1, activePage - 1)));
  const nextParams = new URLSearchParams(paginationParams);
  nextParams.set("page", String(Math.min(totalPages, activePage + 1)));

  const resetParams = new URLSearchParams();
  resetParams.set("month", currentMonthJakarta());

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Operasional</p>
          <h1>Request Schedule Staff</h1>
          <p className="muted">Review request schedule dari staff, lalu approve untuk otomatis masuk ke schedule.</p>
        </div>
      </div>

      {params.reviewed === "1" ? <div className="toast submit">Request schedule berhasil diproses.</div> : null}

      <section className="panel filter-panel">
        <form className="filter-grid">
          <div className="field">
            <label>Store</label>
            <select name="store" defaultValue={selectedStoreId}>
              <option value="all">All Store</option>
              {(stores ?? []).map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Bulan</label>
            <input name="month" type="month" defaultValue={selectedMonth} />
          </div>
          <div className="field">
            <label>Staff</label>
            <select name="staff" defaultValue={selectedStaffId}>
              <option value="all">All Staff</option>
              {(staffRows ?? []).map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.full_name}
                </option>
              ))}
            </select>
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
          <input name="page" type="hidden" value="1" />
          <ScheduleSubmitButton idleText="Tampilkan" pendingText="Sedang menampilkan..." />
          <Link className="button outline" href={`/schedules/requests?${resetParams}`}>
            Reset
          </Link>
        </form>
      </section>

      <section className="panel schedule-request-panel">
        <div className="page-head compact">
          <div>
            <p className="eyebrow">List Request</p>
            <h2>{selectedMonth}</h2>
          </div>
        </div>
        {scheduleRequests?.length ? (
          <div className="table-wrap compact-mobile-wrap schedule-request-table-wrap">
            <table className="compact-mobile-table schedule-request-table">
              <thead>
                <tr>
                  <th>Staff</th>
                  <th>Tanggal</th>
                  <th>Schedule</th>
                  <th>Status</th>
                  <th>Catatan</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {scheduleRequests.map((request) => (
                  <tr key={request.id}>
                    <td>{request.profiles?.full_name ?? "-"}</td>
                    <td>{fullDateLabel(request.request_date)}</td>
                    <td>
                      {request.shift_code} - {shiftMap.get(request.shift_code) ?? "-"}
                    </td>
                    <td>
                      <span className={`badge ${request.status}`}>{request.status}</span>
                    </td>
                    <td>{request.notes ?? "-"}</td>
                    <td>
                      {request.status === "pending" ? (
                        <div className="row-actions">
                          <form action={reviewStaffScheduleRequest}>
                            <input name="request_id" type="hidden" value={request.id} />
                            <input name="decision" type="hidden" value="approve" />
                            <input name="store_id" type="hidden" value={selectedStoreId} />
                            <input name="month" type="hidden" value={selectedMonth} />
                            <ScheduleSubmitButton idleText="Approve" pendingText="Memproses..." />
                          </form>
                          <form action={reviewStaffScheduleRequest}>
                            <input name="request_id" type="hidden" value={request.id} />
                            <input name="decision" type="hidden" value="reject" />
                            <input name="store_id" type="hidden" value={selectedStoreId} />
                            <input name="month" type="hidden" value={selectedMonth} />
                            <ScheduleSubmitButton className="button danger" idleText="Reject" pendingText="Memproses..." />
                          </form>
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">Belum ada request schedule untuk filter ini.</p>
        )}
        {(requestCount ?? 0) > 0 ? (
          <div className="pagination">
            <a aria-label="Halaman sebelumnya" className={`button outline ${activePage <= 1 ? "disabled-link" : ""}`} href={`/schedules/requests?${previousParams}`}>
              ‹
            </a>
            <span className="muted">
              {activePage} / {totalPages}
            </span>
            <a aria-label="Halaman berikutnya" className={`button outline ${activePage >= totalPages ? "disabled-link" : ""}`} href={`/schedules/requests?${nextParams}`}>
              ›
            </a>
          </div>
        ) : null}
      </section>
    </>
  );
}
