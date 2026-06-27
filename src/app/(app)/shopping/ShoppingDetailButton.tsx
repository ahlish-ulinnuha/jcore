"use client";

import { useState } from "react";

export function ShoppingDetailButton({
  notes,
  paymentMethod,
}: {
  notes: string | null;
  paymentMethod: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="button outline" onClick={() => setOpen(true)} type="button">
        Detail
      </button>
      {open ? (
        <div aria-modal="true" className="modal-backdrop" role="dialog">
          <section className="modal-card shopping-detail-modal">
            <div className="modal-head">
              <div>
                <p className="eyebrow">Detail belanja</p>
                <h2>Catatan belanja</h2>
              </div>
              <button aria-label="Tutup" className="icon-button" onClick={() => setOpen(false)} type="button">
                ×
              </button>
            </div>
            <div className="detail-block">
              <span>Metode Pembayaran</span>
              <p>{paymentMethod?.trim() || "-"}</p>
            </div>
            <div className="detail-block">
              <span>Catatan</span>
              <p>{notes?.trim() || "-"}</p>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
