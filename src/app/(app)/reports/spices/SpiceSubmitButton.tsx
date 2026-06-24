"use client";

import { useFormStatus } from "react-dom";

export function SpiceSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className={`button primary ${pending ? "saving" : ""}`} disabled={pending} type="submit">
      {pending ? "Sedang menyimpan..." : "Simpan Report Bumbu"}
    </button>
  );
}
