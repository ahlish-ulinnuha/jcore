"use client";

import { useState } from "react";
import { importShoppingRecordsFromSheet } from "./actions";

export function ImportShoppingButton() {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState("");
  const [isError, setIsError] = useState(false);

  async function runImport() {
    if (importing) return;
    setImporting(true);
    setResult("");
    setIsError(false);
    const outcome = await importShoppingRecordsFromSheet();
    setImporting(false);
    if (!outcome.ok) {
      setIsError(true);
      setResult(outcome.error);
      return;
    }
    setResult(`Selesai: ${outcome.imported} data baru diimport, ${outcome.skipped} dilewati (sudah ada / store tidak cocok).`);
  }

  return (
    <div className="row-actions" style={{ alignItems: "center" }}>
      <button className="button outline" disabled={importing} onClick={runImport} type="button">
        {importing ? "Mengimport..." : "Import dari Google Sheet"}
      </button>
      {result ? <span className={isError ? "muted" : "muted"} style={isError ? { color: "#952423" } : undefined}>{result}</span> : null}
    </div>
  );
}
