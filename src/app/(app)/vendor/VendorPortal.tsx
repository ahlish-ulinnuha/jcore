"use client";

import { Fragment, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { VendorReceipt } from "@/lib/types";
import type { VendorBarangGroup, VendorRequestGroup } from "./page";

function RequestUploadCard({
  group,
  onUploaded,
  receipts,
  requestDate,
  vendorId,
}: {
  group: VendorRequestGroup;
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
    const path = `${vendorId}/${group.requestId}/${Date.now()}-${safeFileName}`;
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
        file_name: file.name,
        receipt_url: publicUrl.publicUrl,
        request_date: requestDate,
        request_id: group.requestId,
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
        <p className="eyebrow">Batch {group.batchNo}</p>
        <h3>{group.requestNo}</h3>
        <p className="muted">Store: {group.storeName}</p>
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
  barangGroups,
  receipts,
  requestDate,
  requestGroups,
  vendorId,
}: {
  barangGroups: VendorBarangGroup[];
  receipts: VendorReceipt[];
  requestDate: string;
  requestGroups: VendorRequestGroup[];
  vendorId: string;
}) {
  const [receiptList, setReceiptList] = useState(receipts);

  function handleUploaded(receipt: VendorReceipt) {
    setReceiptList((current) => [receipt, ...current]);
  }

  return (
    <>
      <section className="panel" style={{ marginBottom: 16 }}>
        <div className="page-head compact">
          <div>
            <p className="eyebrow">Barang</p>
            <h2>List Barang</h2>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Barang</th>
                <th>Batch</th>
                <th>Store</th>
                <th>Qty</th>
              </tr>
            </thead>
            <tbody>
              {barangGroups.map((group) => (
                <Fragment key={group.productId}>
                  {group.rows.map((row, index) => (
                    <tr key={`${group.productId}-${row.requestNo}-${index}`}>
                      {index === 0 ? <td rowSpan={group.rows.length}>{group.displayName}</td> : null}
                      <td>Batch {row.batchNo}</td>
                      <td>{row.storeName}</td>
                      <td>
                        {row.qty} {row.unit}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
              {barangGroups.length === 0 ? (
                <tr>
                  <td colSpan={4}>Belum ada request untuk filter yang dipilih.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="page-head compact">
          <div>
            <p className="eyebrow">Struk</p>
            <h2>Upload Struk per Request</h2>
          </div>
        </div>
        <div className="vendor-request-upload-grid">
          {requestGroups.map((group) => (
            <RequestUploadCard
              group={group}
              key={group.requestId}
              onUploaded={handleUploaded}
              receipts={receiptList.filter((receipt) => receipt.request_id === group.requestId)}
              requestDate={requestDate}
              vendorId={vendorId}
            />
          ))}
          {requestGroups.length === 0 ? <p className="muted">Belum ada request untuk filter yang dipilih.</p> : null}
        </div>
      </section>
    </>
  );
}
