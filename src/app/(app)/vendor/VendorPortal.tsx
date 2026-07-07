"use client";

import { useState } from "react";
import { productDisplayName } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { VendorReceipt } from "@/lib/types";
import type { VendorBatchGroup } from "./page";

export function VendorPortal({
  groups,
  receipts,
  requestDate,
  vendorId,
}: {
  groups: VendorBatchGroup[];
  receipts: VendorReceipt[];
  requestDate: string;
  vendorId: string;
}) {
  const supabase = createClient();
  const [receiptList, setReceiptList] = useState(receipts);
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
    const path = `${vendorId}/${requestDate}/${Date.now()}-${safeFileName}`;
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
        vendor_id: vendorId,
      })
      .select("*")
      .single<VendorReceipt>();

    setUploading(false);
    if (insertError) {
      setMessage(`Struk terupload, tapi belum tersimpan: ${insertError.message}`);
      return;
    }

    if (receipt) setReceiptList((current) => [receipt, ...current]);
    setFile(null);
    setMessage("Struk berhasil disimpan.");
  }

  return (
    <>
      {groups.map((group) => (
        <section className="panel" key={group.requestId} style={{ marginBottom: 16 }}>
          <div className="page-head compact">
            <div>
              <p className="eyebrow">Batch {group.batchNo}</p>
              <h2>{group.requestNo}</h2>
              <p className="muted">Store: {group.storeName}</p>
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
      {groups.length === 0 ? (
        <section className="panel" style={{ marginBottom: 16 }}>
          <p className="muted">Belum ada request untuk filter yang dipilih.</p>
        </section>
      ) : null}

      <section className="panel">
        <div className="page-head compact">
          <div>
            <p className="eyebrow">Struk</p>
            <h2>Upload Struk</h2>
          </div>
        </div>
        {message ? <div className="alert">{message}</div> : null}
        <div className="row-actions">
          <input accept="image/*,.pdf" disabled={uploading} onChange={(event) => setFile(event.target.files?.[0] ?? null)} type="file" />
          <button className="button primary" disabled={uploading || !file} onClick={saveReceipt} type="button">
            {uploading ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
        <div className="receipt-list" style={{ marginTop: 12 }}>
          {receiptList.map((receipt) => (
            <a href={receipt.receipt_url} key={receipt.id} target="_blank">
              {receipt.file_name ?? "Struk"}{" "}
              <span>{new Date(receipt.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span>
            </a>
          ))}
          {receiptList.length === 0 ? <span className="muted">Belum ada struk untuk tanggal ini.</span> : null}
        </div>
      </section>
    </>
  );
}
