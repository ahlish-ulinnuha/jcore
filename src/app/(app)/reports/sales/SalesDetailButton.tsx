"use client";

import { useState } from "react";

export function SalesDetailButton({
  expenseDetail,
  notes,
}: {
  expenseDetail: string | null;
  notes: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="button outline" onClick={() => setOpen(true)} type="button">
        Detail
      </button>
      {open ? (
        <div aria-modal="true" className="modal-backdrop" role="dialog">
          <section className="modal-card sales-detail-modal">
            <div className="modal-head">
              <div>
                <p className="eyebrow">Detail sales</p>
                <h2>Rincian pengeluaran & note</h2>
              </div>
              <button aria-label="Tutup" className="icon-button" onClick={() => setOpen(false)} type="button">
                ×
              </button>
            </div>
            <div className="detail-block">
              <span>Rincian Pengeluaran</span>
              <p>{expenseDetail?.trim() || "-"}</p>
            </div>
            <div className="detail-block">
              <span>Note</span>
              <p>{notes?.trim() || "-"}</p>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
