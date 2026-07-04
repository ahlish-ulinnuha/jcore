"use client";

import { useState } from "react";

function paymentStatusLabel(value: string | null) {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "paid" || normalized === "lunas" || normalized === "sudah_lunas" || normalized === "sudah dibayar") return "Paid";
  if (normalized === "unpaid" || normalized === "belum_lunas" || normalized === "belum dibayar") return "Unpaid";
  return "-";
}

export function ShoppingDetailButton({
  notes,
  paymentMethod,
  paymentStatus,
}: {
  notes: string | null;
  paymentMethod: string | null;
  paymentStatus?: string | null;
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
              <span>Status Pembayaran</span>
              <p>{paymentStatusLabel(paymentStatus ?? null)}</p>
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
