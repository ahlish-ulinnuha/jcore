"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export function SalesSavedModal() {
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
    router.replace(`/reports/sales${params.toString() ? `?${params}` : ""}`);
  }

  if (!open) return null;

  return (
    <div aria-modal="true" className="modal-backdrop" role="dialog">
      <section className="modal-card sales-saved-modal">
        <div className="modal-head">
          <div>
            <p className="eyebrow">Report Sales</p>
            <h2>Penyimpanan berhasil</h2>
          </div>
          <button aria-label="Tutup" className="icon-button" onClick={close} type="button">
            ×
          </button>
        </div>
        <p>Report sales berhasil disimpan.</p>
        <div className="row-actions">
          <button className="button primary" onClick={close} type="button">
            OK
          </button>
        </div>
      </section>
    </div>
  );
}
