"use client";

import { useFormStatus } from "react-dom";

export function SalesDeleteButton() {
  const { pending } = useFormStatus();

  return (
    <button className="button danger" disabled={pending} type="submit">
      {pending ? "Menghapus..." : "Hapus"}
    </button>
  );
}
