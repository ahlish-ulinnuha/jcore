"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { checkInAttendance, checkOutAttendance } from "./actions";

function geolocationErrorMessage(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) return "Akses lokasi ditolak. Izinkan akses lokasi di browser untuk absen.";
  if (error.code === error.POSITION_UNAVAILABLE) return "Lokasi tidak dapat dideteksi. Coba lagi di tempat dengan sinyal GPS lebih baik.";
  return "Gagal mengambil lokasi. Coba lagi.";
}

function actionErrorMessage(error: string) {
  if (error === "missing-store") return "Store belum di-set di profile Anda. Hubungi admin untuk mengatur store.";
  if (error === "missing-location") return "Lokasi tidak terdeteksi. Pastikan izin lokasi browser aktif lalu coba lagi.";
  if (error === "already-checked-in") return "Anda sudah check-in dan belum check-out.";
  if (error === "not-checked-in") return "Anda belum check-in.";
  if (error === "save-failed") return "Gagal menyimpan absensi. Coba lagi.";
  if (error.startsWith("out-of-range")) {
    const params = new URLSearchParams(error.split("&").slice(1).join("&"));
    return `Lokasi Anda di luar radius toko (jarak ${params.get("distance") ?? "?"}m, radius ${params.get("radius") ?? "?"}m).`;
  }
  return "Terjadi kesalahan. Coba lagi.";
}

export function AttendanceCheckForm({ hasOpenSession }: { hasOpenSession: boolean }) {
  const router = useRouter();
  const [locating, setLocating] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  function submit() {
    setError(null);
    setSuccess(null);
    if (!("geolocation" in navigator)) {
      setError("Browser tidak mendukung geolocation.");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const formData = new FormData();
        formData.set("latitude", String(position.coords.latitude));
        formData.set("longitude", String(position.coords.longitude));
        formData.set("accuracy", String(position.coords.accuracy));
        if (hasOpenSession) formData.set("notes", notes);
        startTransition(async () => {
          const result = await (hasOpenSession ? checkOutAttendance : checkInAttendance)(formData);
          if (!result.ok) {
            setError(actionErrorMessage(result.error));
            return;
          }
          setNotes("");
          setSuccess(hasOpenSession ? "Check-out berhasil dicatat." : "Check-in berhasil dicatat.");
          router.refresh();
        });
      },
      (positionError) => {
        setLocating(false);
        setError(geolocationErrorMessage(positionError));
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  const busy = locating || pending;

  return (
    <div className="attendance-check-form">
      {hasOpenSession ? (
        <div className="field">
          <label>Catatan Check-out (opsional)</label>
          <input onChange={(event) => setNotes(event.target.value)} placeholder="Opsional" value={notes} />
        </div>
      ) : null}
      <button
        className={`button ${hasOpenSession ? "danger" : "primary"} ${busy ? "saving" : ""}`}
        disabled={busy}
        onClick={submit}
        type="button"
      >
        {busy ? <span className="button-spinner" aria-hidden="true" /> : null}
        {locating ? "Mengambil lokasi..." : pending ? "Menyimpan..." : hasOpenSession ? "Check Out" : "Check In"}
      </button>
      {error ? <p className="attendance-error">{error}</p> : null}
      {success ? <p className="attendance-success">{success}</p> : null}
    </div>
  );
}
