"use client";

import { useState } from "react";
import { productDisplayName } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { VendorReceipt } from "@/lib/types";
import type { VendorBatchGroup } from "./page";

function BatchUploadCard({
  group,
  onUploaded,
  receipts,
  requestDate,
  vendorId,
}: {
  group: VendorBatchGroup;
  onUploaded: (receipt: VendorReceipt) => void;
  receipts: VendorReceipt[];
  requestDate: string;
  vendorId: string;
}) {
  const supabase = createClient();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  async function saveReceipt() {
    if (!file) {
      setMessage("Pilih file struk terlebih dahulu.");
      return;
    }

    setUploading(true);
    setMessage("");
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${vendorId}/batch-${group.batchNo}/${Date.now()}-${safeFileName}`;
    const { error: uploadError } = await supabase.storage.from("vendor-receipts").upload(path, file, {
      contentType: file.type || undefined,
      upsert: true,
    });

    if (uploadError) {
      setUploading(false);
      setMessage(`Upload struk belum berhasil: ${uploadError.message}`);
      return;
    }

    const { data: publicUrl } = supabase.storage.from("vendor-receipts").getPublicUrl(path);
    const { data: receipt, error: insertError } = await supabase
      .from("vendor_receipts")
      .insert({
        batch_no: group.batchNo,
        file_name: file.name,
        receipt_url: publicUrl.publicUrl,
        request_date: requestDate,
        vendor_id: vendorId,
      })
      .select("*")
      .single<VendorReceipt>();

    setUploading(false);
    if (insertError) {
      setMessage(`Struk terupload, tapi belum tersimpan: ${insertError.message}`);
      return;
    }

    if (receipt) onUploaded(receipt);
    setFile(null);
    setMessage("Struk berhasil disimpan.");
  }

  return (
    <div className="panel vendor-request-upload-card">
      <div>
        <p className="eyebrow">Batch</p>
        <h3>Batch {group.batchNo}</h3>
        <p className="muted">Store: {group.storeNames.join(", ")}</p>
      </div>
      {message ? <div className="alert">{message}</div> : null}
      <div className="row-actions">
        <input accept="image/*,.pdf" disabled={uploading} onChange={(event) => setFile(event.target.files?.[0] ?? null)} type="file" />
        <button className="button primary" disabled={uploading || !file} onClick={saveReceipt} type="button">
          {uploading ? "Menyimpan..." : "Simpan"}
        </button>
      </div>
      <div className="receipt-list" style={{ marginTop: 10 }}>
        {receipts.map((receipt) => (
          <a href={receipt.receipt_url} key={receipt.id} target="_blank">
            {receipt.file_name ?? "Struk"}{" "}
            <span>{new Date(receipt.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span>
          </a>
        ))}
        {receipts.length === 0 ? <span className="muted">Belum ada struk.</span> : null}
      </div>
    </div>
  );
}

export function VendorPortal({
  batchGroups,
  receipts,
  requestDate,
  vendorId,
}: {
  batchGroups: VendorBatchGroup[];
  receipts: VendorReceipt[];
  requestDate: string;
  vendorId: string;
}) {
  const [receiptList, setReceiptList] = useState(receipts);

  function handleUploaded(receipt: VendorReceipt) {
    setReceiptList((current) => [receipt, ...current]);
  }

  return (
    <>
      {batchGroups.map((group) => (
        <section className="panel" key={group.batchNo} style={{ marginBottom: 16 }}>
          <div className="page-head compact">
            <div>
              <p className="eyebrow">Batch {group.batchNo}</p>
              <h2>Request {group.requestNos.join(", ")}</h2>
              <p className="muted">Store: {group.storeNames.join(", ")}</p>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Barang</th>
                  <th>Qty</th>
                </tr>
              </thead>
              <tbody>
                {group.items.map((item) => (
                  <tr key={item.id}>
                    <td>{productDisplayName(item.products)}</td>
                    <td>
                      {item.qty} {item.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      {batchGroups.length === 0 ? (
        <section className="panel" style={{ marginBottom: 16 }}>
          <p className="muted">Belum ada request untuk filter yang dipilih.</p>
        </section>
      ) : null}

      <section className="panel">
        <div className="page-head compact">
          <div>
            <p className="eyebrow">Struk</p>
            <h2>Upload Struk per Batch</h2>
          </div>
        </div>
        <div className="vendor-request-upload-grid">
          {batchGroups.map((group) => (
            <BatchUploadCard
              group={group}
              key={group.batchNo}
              onUploaded={handleUploaded}
              receipts={receiptList.filter((receipt) => receipt.batch_no === group.batchNo)}
              requestDate={requestDate}
              vendorId={vendorId}
            />
          ))}
          {batchGroups.length === 0 ? <p className="muted">Belum ada request untuk filter yang dipilih.</p> : null}
        </div>
      </section>
    </>
  );
}
