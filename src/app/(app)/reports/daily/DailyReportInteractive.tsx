"use client";

import { useState } from "react";
import type { PurchaseRequestItem } from "@/lib/types";
import { CopySummaryButton } from "./CopySummaryButton";
import { SendVendorMessageButton } from "./SendVendorMessageButton";

type InteractiveRow = {
  batchNo: number;
  itemNotes: string[];
  productName: string;
  qty: number;
  rowKey: string;
  status: PurchaseRequestItem["status"];
  storeNames: string[];
  summaryProductName: string;
  unit: string;
  vendorId: string;
  vendorName: string;
};

type VendorGroup = {
  rows: InteractiveRow[];
  vendorId: string;
  vendorMessage: string;
  vendorName: string;
};

type BatchGroup = {
  batchNo: string;
  vendors: VendorGroup[];
};

type SpiceSummaryRow = {
  redSpiceStock: number;
  storeName: string;
  whiteSpiceStock: number;
};

function shouldShowStoreNames(vendorName: string) {
  return vendorName.trim().toUpperCase() !== "NR";
}

function statusLabel(status: PurchaseRequestItem["status"]) {
  if (status === "fulfilled") return "Fulfilled";
  if (status === "unavailable") return "Unavailable";
  return status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusIcon(status: PurchaseRequestItem["status"]) {
  if (status === "fulfilled") return "✓";
  if (status === "unavailable") return "∅";
  if (status === "partially_available") return "½";
  if (status === "cancelled") return "×";
  if (status === "confirmed") return "✓";
  return "⏳";
}

export function DailyReportInteractive({
  batchGroups,
  canSendVendorMessage,
  date,
  includeAllStoreTotal,
  isAdmin,
  outletName,
  requestDateLabel,
  spiceRows,
}: {
  batchGroups: BatchGroup[];
  canSendVendorMessage: boolean;
  date: string;
  includeAllStoreTotal: boolean;
  isAdmin: boolean;
  outletName: string;
  requestDateLabel: string;
  spiceRows: SpiceSummaryRow[];
}) {
  const [j2Keys, setJ2Keys] = useState<Set<string>>(new Set());

  function toggleJ2(rowKey: string) {
    setJ2Keys((current) => {
      const next = new Set(current);
      if (next.has(rowKey)) next.delete(rowKey);
      else next.add(rowKey);
      return next;
    });
  }

  const summaryRows = batchGroups.flatMap((batchGroup) =>
    batchGroup.vendors.flatMap((vendor) =>
      vendor.rows.map((row) => ({
        groupOverride: j2Keys.has(row.rowKey) ? "J2" : undefined,
        note: isAdmin && row.itemNotes.length > 0 ? row.itemNotes.join("; ") : undefined,
        productName: row.summaryProductName,
        qty: row.qty,
        storeNames: row.storeNames,
        unit: row.unit,
        vendorName: row.vendorName,
      })),
    ),
  );

  return (
    <>
      <div className="filter-actions">
        <CopySummaryButton
          date={date}
          includeAllStoreTotal={includeAllStoreTotal}
          outletName={outletName}
          rows={summaryRows}
          spiceRows={spiceRows}
        />
      </div>

      {batchGroups.map((batchGroup) => (
        <section className="panel daily-report-group" key={batchGroup.batchNo}>
          <h2>
            Batch {batchGroup.batchNo} <span className="muted">- {requestDateLabel}</span>
          </h2>
          <div className="vendor-report-list">
            {batchGroup.vendors.map((vendor) => (
              <section className="vendor-report-group" key={`${batchGroup.batchNo}-${vendor.vendorId}`}>
                <div className="vendor-report-group-head">
                  <h3>{vendor.vendorName}</h3>
                  {canSendVendorMessage ? (
                    <SendVendorMessageButton
                      batchNo={Number(batchGroup.batchNo)}
                      message={vendor.vendorMessage}
                      requestDate={date}
                      vendorId={vendor.vendorId}
                    />
                  ) : null}
                </div>
                <div className="report-item-list">
                  {vendor.rows.map((row) => (
                    <div className="report-item-row" key={row.rowKey}>
                      <span className="report-item-product">{row.productName}</span>
                      {shouldShowStoreNames(row.vendorName) && row.storeNames.length > 0 ? (
                        <span className="report-item-stores muted">{[...row.storeNames].sort().join(", ")}</span>
                      ) : null}
                      {isAdmin && row.itemNotes.length > 0 ? (
                        <span className="report-item-note muted">{row.itemNotes.join("; ")}</span>
                      ) : null}
                      <span className="report-item-qty">{row.qty}</span>
                      <label className="checkbox-line report-item-j2-toggle">
                        <input checked={j2Keys.has(row.rowKey)} onChange={() => toggleJ2(row.rowKey)} type="checkbox" />
                        Ambil dari J2
                      </label>
                      <span
                        aria-label={statusLabel(row.status)}
                        className={`status-icon ${row.status}`}
                        data-tooltip={statusLabel(row.status)}
                        tabIndex={0}
                      >
                        {statusIcon(row.status)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
