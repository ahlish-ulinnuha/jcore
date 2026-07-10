"use client";

import { useState } from "react";

type SummaryRow = {
  productName: string;
  qty: number;
  storeNames?: string[];
  unit?: string;
  vendorName: string;
};

type SpiceSummaryRow = {
  redSpiceStock: number;
  storeName: string;
  whiteSpiceStock: number;
};

function formatDate(date: string) {
  const [year, month, day] = date.split("-");
  return `${day}-${month}-${year}`;
}

function formatQty(value: number) {
  return Number.isInteger(value) ? String(value) : String(value).replace(/\.?0+$/, "");
}

function shouldShowStoreNames(vendorName: string) {
  return vendorName.trim().toUpperCase() !== "NR";
}

export function CopySummaryButton({
  date,
  includeAllStoreTotal = true,
  outletName,
  rows,
  spiceRows,
}: {
  date: string;
  includeAllStoreTotal?: boolean;
  outletName: string;
  rows: SummaryRow[];
  spiceRows?: SpiceSummaryRow[];
}) {
  const [copied, setCopied] = useState(false);
  const [includeSpiceStock, setIncludeSpiceStock] = useState(true);

  async function copySummary() {
    const activeDate = new URLSearchParams(window.location.search).get("date") ?? date;
    const grouped = rows.reduce<Record<string, SummaryRow[]>>((acc, row) => {
      acc[row.vendorName] ??= [];
      acc[row.vendorName].push(row);
      return acc;
    }, {});

    const sections = Object.entries(grouped)
      .sort(([vendorA], [vendorB]) => vendorA.localeCompare(vendorB))
      .map(([vendorName, vendorRows]) => {
        const lines = vendorRows
          .sort((a, b) => a.productName.localeCompare(b.productName))
          .map((row) => {
            const storeNames = shouldShowStoreNames(row.vendorName) ? [...(row.storeNames ?? [])].sort().join(" ") : "";
            const productName = storeNames ? `${row.productName} ${storeNames}` : row.productName;
            const unit = row.unit?.trim();
            return `- ${productName} / ${row.qty}${unit ? ` ${unit}` : ""}`;
          });
        return [`Request ${vendorName}`, ...lines].join("\n");
      });

    const sortedSpiceRows = includeSpiceStock ? [...(spiceRows ?? [])].sort((a, b) => a.storeName.localeCompare(b.storeName)) : [];
    const totalRedSpice = sortedSpiceRows.reduce((total, row) => total + row.redSpiceStock, 0);
    const totalWhiteSpice = sortedSpiceRows.reduce((total, row) => total + row.whiteSpiceStock, 0);
    const spiceSection = sortedSpiceRows.length
      ? [
          "Stock Bumbu",
          ...sortedSpiceRows.map((row) => `- ${row.storeName}: merah ${formatQty(row.redSpiceStock)}, putih ${formatQty(row.whiteSpiceStock)}`),
          ...(includeAllStoreTotal ? [`- All store: merah ${formatQty(totalRedSpice)}, putih ${formatQty(totalWhiteSpice)}`] : []),
        ].join("\n")
      : "";
    const allSections = spiceSection ? [...sections, spiceSection] : sections;
    const text = [`*_📋✨ Summary Request ${formatDate(activeDate)}_*`, `Outlet: ${outletName}`, ...allSections].join("\n------------------------------ \n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="copy-summary-actions">
      <label className="checkbox-line">
        <input
          checked={includeSpiceStock}
          onChange={(event) => setIncludeSpiceStock(event.target.checked)}
          type="checkbox"
        />
        Tampilkan stock bumbu
      </label>
      <button className="button outline" disabled={rows.length === 0 && (!includeSpiceStock || !spiceRows?.length)} onClick={copySummary} type="button">
        {copied ? "Copied" : "Copy Summary"}
      </button>
    </div>
  );
}
