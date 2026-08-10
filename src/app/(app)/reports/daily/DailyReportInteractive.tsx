"use client";

import { useState } from "react";
import type { PurchaseRequestItem } from "@/lib/types";
import { CopySummaryButton } from "./CopySummaryButton";
import { SendVendorMessageButton } from "./SendVendorMessageButton";

type InteractiveRow = {
  batchNo: number;
  itemNotes: string[];
  productId: string;
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

type SpiceRequestState = {
  ambilDariJG2: boolean;
  requestRed: string;
  requestWhite: string;
};

const emptySpiceRequest: SpiceRequestState = { ambilDariJG2: false, requestRed: "", requestWhite: "" };

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

function displayDate(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}-${month}-${year}`;
}

function lastRequestLabel(productId: string, lastRequestByProductId: Record<string, string>) {
  const value = lastRequestByProductId[productId];
  return value ? displayDate(value) : "-";
}

export function DailyReportInteractive({
  batchGroups,
  canSendVendorMessage,
  date,
  includeAllStoreTotal,
  isAdmin,
  lastRequestByProductId,
  outletName,
  requestDateLabel,
  spiceRows,
}: {
  batchGroups: BatchGroup[];
  canSendVendorMessage: boolean;
  date: string;
  includeAllStoreTotal: boolean;
  isAdmin: boolean;
  lastRequestByProductId: Record<string, string>;
  outletName: string;
  requestDateLabel: string;
  spiceRows: SpiceSummaryRow[];
}) {
  const [j2Keys, setJ2Keys] = useState<Set<string>>(new Set());
  const [slackNotes, setSlackNotes] = useState<Record<string, string>>({});
  const [spiceRequests, setSpiceRequests] = useState<Record<string, SpiceRequestState>>({});

  function toggleJ2(rowKey: string) {
    setJ2Keys((current) => {
      const next = new Set(current);
      if (next.has(rowKey)) next.delete(rowKey);
      else next.add(rowKey);
      return next;
    });
  }

  function updateSlackNote(rowKey: string, value: string) {
    setSlackNotes((current) => ({ ...current, [rowKey]: value }));
  }

  function updateSpiceRequest(storeName: string, patch: Partial<SpiceRequestState>) {
    setSpiceRequests((current) => ({
      ...current,
      [storeName]: { ...emptySpiceRequest, ...current[storeName], ...patch },
    }));
  }

  const summaryRows = batchGroups.flatMap((batchGroup) =>
    batchGroup.vendors.flatMap((vendor) =>
      vendor.rows.map((row) => {
        const notes = [
          isAdmin && row.itemNotes.length > 0 ? row.itemNotes.join("; ") : "",
          slackNotes[row.rowKey]?.trim() ?? "",
        ].filter(Boolean);
        return {
          groupOverride: j2Keys.has(row.rowKey) ? "ambil dari J2" : undefined,
          note: notes.length > 0 ? notes.join("; ") : undefined,
          productName: row.summaryProductName,
          qty: row.qty,
          storeNames: row.storeNames,
          unit: row.unit,
          vendorName: row.vendorName,
        };
      }),
    ),
  );

  const enrichedSpiceRows = spiceRows.map((row) => {
    const request = spiceRequests[row.storeName];
    return {
      ...row,
      ambilDariJG2: request?.ambilDariJG2 ?? false,
      requestRed: request?.requestRed ?? "",
      requestWhite: request?.requestWhite ?? "",
    };
  });

  return (
    <>
      <div className="filter-actions">
        <CopySummaryButton
          date={date}
          includeAllStoreTotal={includeAllStoreTotal}
          outletName={outletName}
          rows={summaryRows}
          spiceRows={enrichedSpiceRows}
        />
      </div>

      {spiceRows.length > 0 ? (
        <section className="panel daily-report-group">
          <h2>Stock Bumbu</h2>
          <div className="table-wrap compact-mobile-wrap">
            <table className="compact-mobile-table report-item-table">
              <thead>
                <tr>
                  <th>Store</th>
                  <th>Stock Merah</th>
                  <th>Stock Putih</th>
                  <th>Request Bumbu Merah</th>
                  <th>Request Bumbu Putih</th>
                  <th>Ambil dari JG2</th>
                </tr>
              </thead>
              <tbody>
                {[...spiceRows]
                  .sort((a, b) => a.storeName.localeCompare(b.storeName))
                  .map((row) => {
                    const request = spiceRequests[row.storeName] ?? emptySpiceRequest;
                    return (
                      <tr key={row.storeName}>
                        <td>{row.storeName}</td>
                        <td>{row.redSpiceStock}</td>
                        <td>{row.whiteSpiceStock}</td>
                        <td>
                          <input
                            aria-label={`Request Bumbu Merah ${row.storeName}`}
                            onChange={(event) => updateSpiceRequest(row.storeName, { requestRed: event.target.value })}
                            placeholder="Jika perlu"
                            value={request.requestRed}
                          />
                        </td>
                        <td>
                          <input
                            aria-label={`Request Bumbu Putih ${row.storeName}`}
                            onChange={(event) => updateSpiceRequest(row.storeName, { requestWhite: event.target.value })}
                            placeholder="Jika perlu"
                            value={request.requestWhite}
                          />
                        </td>
                        <td>
                          <label className="checkbox-line report-item-j2-toggle">
                            <input
                              checked={request.ambilDariJG2}
                              onChange={(event) => updateSpiceRequest(row.storeName, { ambilDariJG2: event.target.checked })}
                              type="checkbox"
                            />
                            Ambil dari JG2
                          </label>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

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
                <div className="table-wrap compact-mobile-wrap">
                  <table className="compact-mobile-table report-item-table">
                    <thead>
                      <tr>
                        <th>Barang</th>
                        <th>Store</th>
                        <th>Qty</th>
                        <th>Ambil dari J2</th>
                        <th>Catatan Slack</th>
                        <th>Status</th>
                        {isAdmin ? <th>Last Request</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {vendor.rows.map((row) => (
                        <tr key={row.rowKey}>
                          <td>{row.productName}</td>
                          <td>{row.storeNames.length > 0 ? [...row.storeNames].sort().join(", ") : "-"}</td>
                          <td>{row.qty}</td>
                          <td>
                            <label className="checkbox-line report-item-j2-toggle">
                              <input checked={j2Keys.has(row.rowKey)} onChange={() => toggleJ2(row.rowKey)} type="checkbox" />
                              Ambil dari J2
                            </label>
                          </td>
                          <td>
                            <input
                              aria-label={`Catatan Slack ${row.productName}`}
                              onChange={(event) => updateSlackNote(row.rowKey, event.target.value)}
                              placeholder="Catatan (opsional)"
                              value={slackNotes[row.rowKey] ?? ""}
                            />
                          </td>
                          <td>
                            <span
                              aria-label={statusLabel(row.status)}
                              className={`status-icon ${row.status}`}
                              data-tooltip={statusLabel(row.status)}
                              tabIndex={0}
                            >
                              {statusIcon(row.status)}
                            </span>
                          </td>
                          {isAdmin ? <td>{lastRequestLabel(row.productId, lastRequestByProductId)}</td> : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
