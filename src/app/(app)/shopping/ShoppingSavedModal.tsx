"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export function ShoppingSavedModal() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const saved = searchParams.get("saved") === "1";
  const [open, setOpen] = useState(saved);

  useEffect(() => {
    setOpen(saved);
  }, [saved]);

  function close() {
    setOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("saved");
    router.replace(`/shopping${params.toString() ? `?${params}` : ""}`);
  }

  if (!open) return null;

  return (
    <div aria-modal="true" className="modal-backdrop" role="dialog">
      <section className="modal-card shopping-saved-modal">
        <div className="modal-head">
          <div>
            <p className="eyebrow">Belanja</p>
            <h2>Penyimpanan berhasil</h2>
          </div>
          <button aria-label="Tutup" className="icon-button" onClick={close} type="button">
            ×
          </button>
        </div>
        <p>Data belanja berhasil dikirim ke Google Sheet.</p>
        <div className="row-actions">
          <button className="button primary" onClick={close} type="button">
            OK
          </button>
        </div>
      </section>
    </div>
  );
}
