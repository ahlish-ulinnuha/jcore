"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { productDisplayName } from "@/lib/format";
import type { PurchaseRequestItem } from "@/lib/types";

const statuses = ["requested", "confirmed", "unavailable", "partially_available", "fulfilled", "cancelled"] as const;
type VendorItem = PurchaseRequestItem & {
  purchase_requests?: {
    request_no?: string;
    batch_no?: number;
    store_name?: string;
  } | null;
};

export function VendorPortal({ items }: { items: VendorItem[] }) {
  const supabase = createClient();
  const [rows, setRows] = useState(items);
  const [message, setMessage] = useState("");
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  async function updateItem(itemId: string, patch: Partial<PurchaseRequestItem>) {
    setMessage("");
    const { error } = await supabase.from("purchase_request_items").update(patch).eq("id", itemId);

    if (error) {
      setMessage(`Update belum berhasil: ${error.message}`);
      return false;
    }

    setRows((current) => current.map((item) => (item.id === itemId ? { ...item, ...patch } : item)));
    return true;
  }

  async function uploadReceipt(itemId: string, file: File | null) {
    if (!file) return;
    setMessage("");
    setUploadingId(itemId);
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${itemId}/${Date.now()}-${safeFileName}`;
    const { error: uploadError } = await supabase.storage.from("vendor-receipts").upload(path, file, {
      contentType: file.type || undefined,
      upsert: true,
    });

    if (uploadError) {
      setMessage(`Upload struk belum berhasil: ${uploadError.message}`);
      setUploadingId(null);
      return;
    }

    const { data } = supabase.storage.from("vendor-receipts").getPublicUrl(path);
    const updated = await updateItem(itemId, { receipt_url: data.publicUrl });
    setUploadingId(null);
    if (updated) setMessage("Struk berhasil diupload.");
  }

  return (
    <section className="panel">
      {message ? <div className="alert">{message}</div> : null}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Request</th>
              <th>Store</th>
              <th>Barang</th>
              <th>Qty</th>
              <th>Status</th>
              <th>Catatan</th>
              <th>Struk</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item.id}>
                <td>
                  {item.purchase_requests?.request_no ?? "-"}
                  <br />
                  <span className="muted">Batch {item.purchase_requests?.batch_no ?? "-"}</span>
                </td>
                <td>{item.purchase_requests?.store_name ?? "-"}</td>
                <td>
                  {productDisplayName(item.products)}
                </td>
                <td>
                  {item.qty} {item.unit}
                </td>
                <td>
                  <select value={item.status} onChange={(event) => updateItem(item.id, { status: event.target.value as PurchaseRequestItem["status"] })}>
                    {statuses.map((status) => (
                      <option key={status} value={status}>
                        {status.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    defaultValue={item.vendor_note ?? ""}
                    onBlur={(event) => updateItem(item.id, { vendor_note: event.target.value })}
                    placeholder="Catatan ketersediaan"
                  />
                </td>
                <td>
                  <div className="row-actions">
                    <input disabled={uploadingId === item.id} type="file" accept="image/*,.pdf" onChange={(event) => uploadReceipt(item.id, event.target.files?.[0] ?? null)} />
                    {uploadingId === item.id ? <span className="muted">Uploading...</span> : null}
                    {item.receipt_url ? (
                      <a className="button" href={item.receipt_url} target="_blank">
                        Lihat
                      </a>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7}>Belum ada item untuk vendor ini.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
