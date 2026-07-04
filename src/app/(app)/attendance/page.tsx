import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, StaffAttendance, Store } from "@/lib/types";
import { AttendanceCheckForm } from "./AttendanceCheckForm";

type StaffAttendanceRow = StaffAttendance & {
  profiles?: Profile | null;
  stores?: Store | null;
};

type SearchParams = Promise<{
  date_from?: string;
  date_to?: string;
  distance?: string;
  error?: string;
  radius?: string;
  saved?: string;
  store?: string;
}>;

function todayJakarta() {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Jakarta",
    year: "numeric",
  }).format(new Date());
}

function monthStartJakarta() {
  return `${todayJakarta().slice(0, 7)}-01`;
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value));
}

function formatDistance(value: number | null) {
  if (value === null || value === undefined) return "-";
  return `${Math.round(value)} m`;
}

function errorMessage(error: string | undefined, distance: string | undefined, radius: string | undefined) {
  if (error === "missing-store") return "Store belum di-set di profile Anda. Hubungi admin untuk mengatur store.";
  if (error === "missing-location") return "Lokasi tidak terdeteksi. Pastikan izin lokasi browser aktif lalu coba lagi.";
  if (error === "already-checked-in") return "Anda sudah check-in dan belum check-out.";
  if (error === "not-checked-in") return "Anda belum check-in.";
  if (error === "save-failed") return "Gagal menyimpan absensi. Coba lagi.";
  if (error === "out-of-range") return `Lokasi Anda di luar radius toko (jarak ${distance ?? "?"}m, radius ${radius ?? "?"}m).`;
  return null;
}

export default async function AttendancePage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*, stores(*)").eq("id", user.id).single<Profile>();
  if (!profile || profile.role === "vendor") redirect("/dashboard");

  const params = await searchParams;
  const error = errorMessage(params.error, params.distance, params.radius);
  const saved = params.saved;

  if (profile.role === "staff") {
    const { data: openSession } = await supabase
      .from("staff_attendance")
      .select("*")
      .eq("staff_id", user.id)
      .is("check_out_at", null)
      .maybeSingle<StaffAttendance>();

    const { data: history } = await supabase
      .from("staff_attendance")
      .select("*")
      .eq("staff_id", user.id)
      .order("check_in_at", { ascending: false })
      .limit(30)
      .returns<StaffAttendance[]>();

    return (
      <>
        <div className="page-head">
          <div>
            <p className="eyebrow">Absensi</p>
            <h1>Check In / Check Out</h1>
            <p className="muted">Absen dengan lokasi Anda saat ini. Store: {profile.stores?.name ?? profile.store_name ?? "-"}</p>
          </div>
        </div>

        {saved === "checkin" ? <div className="toast submit">Check-in berhasil dicatat.</div> : null}
        {saved === "checkout" ? <div className="toast submit">Check-out berhasil dicatat.</div> : null}
        {error ? <div className="toast delete">{error}</div> : null}

        <section className="panel attendance-panel">
          {openSession ? (
            <div className="attendance-status">
              <span className="payment-status-badge paid">Sedang bekerja</span>
              <p>Check-in {formatDateTime(openSession.check_in_at)}</p>
            </div>
          ) : (
            <div className="attendance-status">
              <span className="payment-status-badge unpaid">Belum check-in</span>
            </div>
          )}
          <AttendanceCheckForm hasOpenSession={Boolean(openSession)} />
        </section>

        <section className="panel" style={{ marginTop: 16 }}>
          <div className="page-head compact">
            <div>
              <p className="eyebrow">History</p>
              <h2>Riwayat Absensi Saya</h2>
            </div>
          </div>
          <div className="table-wrap compact-mobile-wrap">
            <table className="compact-mobile-table">
              <thead>
                <tr>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Jarak In</th>
                  <th>Jarak Out</th>
                  <th>Catatan</th>
                </tr>
              </thead>
              <tbody>
                {(history ?? []).map((item) => (
                  <tr key={item.id}>
                    <td>{formatDateTime(item.check_in_at)}</td>
                    <td>{formatDateTime(item.check_out_at)}</td>
                    <td>{formatDistance(item.check_in_distance_m)}</td>
                    <td>{formatDistance(item.check_out_distance_m)}</td>
                    <td>{item.notes || "-"}</td>
                  </tr>
                ))}
                {(history ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5}>Belum ada riwayat absensi.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </>
    );
  }

  const dateFrom = params.date_from ?? monthStartJakarta();
  const dateTo = params.date_to ?? todayJakarta();
  const selectedStore = params.store ?? "all";

  const { data: stores } = await supabase.from("stores").select("*").eq("is_active", true).order("name").returns<Store[]>();

  const attendanceQuery = supabase
    .from("staff_attendance")
    .select("*, profiles(*), stores(*)")
    .gte("check_in_at", `${dateFrom}T00:00:00+07:00`)
    .lte("check_in_at", `${dateTo}T23:59:59+07:00`)
    .order("check_in_at", { ascending: false });

  if (selectedStore !== "all") attendanceQuery.eq("store_id", selectedStore);

  const { data: attendanceRows } = await attendanceQuery.returns<StaffAttendanceRow[]>();
  const rows = attendanceRows ?? [];
  const openCount = rows.filter((row) => !row.check_out_at).length;

  const resetParams = new URLSearchParams();

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Absensi</p>
          <h1>Absensi Staff</h1>
          <p className="muted">Riwayat check-in/check-out staff beserta lokasi.</p>
        </div>
      </div>

      {error ? <div className="toast delete">{error}</div> : null}

      <section className="grid cols-3">
        <div className="panel stat stat-primary">
          <span className="muted">Total Absensi</span>
          <strong>{rows.length}</strong>
        </div>
        <div className="panel stat">
          <span className="muted">Sedang Bekerja</span>
          <strong>{openCount}</strong>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <form className="filter-grid" style={{ marginBottom: 14 }}>
          <div className="field">
            <label>Dari Tanggal</label>
            <input defaultValue={dateFrom} name="date_from" type="date" />
          </div>
          <div className="field">
            <label>Sampai Tanggal</label>
            <input defaultValue={dateTo} name="date_to" type="date" />
          </div>
          <div className="field">
            <label>Store</label>
            <select defaultValue={selectedStore} name="store">
              <option value="all">All Store</option>
              {(stores ?? []).map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </div>
          <button className="button primary" type="submit">
            Filter
          </button>
          <Link className="button outline" href={`/attendance?${resetParams}`}>
            Reset
          </Link>
        </form>

        <div className="table-wrap compact-mobile-wrap">
          <table className="compact-mobile-table">
            <thead>
              <tr>
                <th>Staff</th>
                <th>Store</th>
                <th>Check In</th>
                <th>Jarak In</th>
                <th>Check Out</th>
                <th>Jarak Out</th>
                <th>Catatan</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.profiles?.full_name ?? "-"}</td>
                  <td>{row.stores?.name ?? "-"}</td>
                  <td>{formatDateTime(row.check_in_at)}</td>
                  <td>{formatDistance(row.check_in_distance_m)}</td>
                  <td>
                    {row.check_out_at ? (
                      formatDateTime(row.check_out_at)
                    ) : (
                      <span className="payment-status-badge paid">Sedang bekerja</span>
                    )}
                  </td>
                  <td>{formatDistance(row.check_out_distance_m)}</td>
                  <td>{row.notes || "-"}</td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7}>Belum ada data absensi pada filter ini.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
