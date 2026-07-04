"use client";

import { useState, useTransition } from "react";
import { checkInAttendance, checkOutAttendance } from "./actions";

function geolocationErrorMessage(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) return "Akses lokasi ditolak. Izinkan akses lokasi di browser untuk absen.";
  if (error.code === error.POSITION_UNAVAILABLE) return "Lokasi tidak dapat dideteksi. Coba lagi di tempat dengan sinyal GPS lebih baik.";
  return "Gagal mengambil lokasi. Coba lagi.";
}

export function AttendanceCheckForm({ hasOpenSession }: { hasOpenSession: boolean }) {
  const [locating, setLocating] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  function submit() {
    setError(null);
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
          await (hasOpenSession ? checkOutAttendance : checkInAttendance)(formData);
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
        {locating ? "Mengambil lokasi..." : pending ? "Menyimpan..." : hasOpenSession ? "Check Out" : "Check In"}
      </button>
      {error ? <p className="attendance-error">{error}</p> : null}
    </div>
  );
}
