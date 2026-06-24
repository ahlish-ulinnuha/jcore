"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { productDisplayName } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { ProductVendorPrice, PurchaseRequestItem, VendorReceipt } from "@/lib/types";
import { saveAdminVendorItem } from "./actions";

const statuses = ["requested", "confirmed", "unavailable", "partially_available", "fulfilled", "cancelled"] as const;

type AdminVendorItem = PurchaseRequestItem & {
  purchase_requests?: {
    batch_no?: number;
    request_date?: string;
    request_no?: string;
    store_name?: string;
    status?: string;
  } | null;
};

type VendorGroup = {
  items: AdminVendorItem[];
  receipts: VendorReceipt[];
  vendorId: string;
  vendorName: string;
};

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button className="button outline" disabled={pending} type="submit">
      {pending ? "Menyimpan..." : "Simpan"}
    </button>
  );
}

function formatPrice(value?: number | null) {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(Number(value));
}

export function AdminVendorPortal({
  groups,
  priceRows,
  requestDate,
}: {
  groups: VendorGroup[];
  priceRows: ProductVendorPrice[];
  requestDate: string;
}) {
  const supabase = createClient();
  const [receiptGroups, setReceiptGroups] = useState<Record<string, VendorReceipt[]>>(
    Object.fromEntries(groups.map((group) => [group.vendorId, group.receipts])),
  );
  const [message, setMessage] = useState("");
  const [uploadingVendorId, setUploadingVendorId] = useState<string | null>(null);
  const priceMap = new Map(priceRows.map((row) => [`${row.product_id}:${row.vendor_id}`, row.current_price]));

  async function uploadReceipt(vendorId: string, file: File | null) {
    if (!file) return;
    setMessage("");
    setUploadingVendorId(vendorId);
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `admin-vendor/${vendorId}/${requestDate}/${Date.now()}-${safeFileName}`;
    const { error: uploadError } = await supabase.storage.from("vendor-receipts").upload(path, file, {
      contentType: file.type || undefined,
      upsert: true,
    });

    if (uploadError) {
      setMessage(`Upload struk belum berhasil: ${uploadError.message}`);
      setUploadingVendorId(null);
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

    setUploadingVendorId(null);
    if (insertError) {
      setMessage(`Struk terupload, tapi belum tersimpan ke database: ${insertError.message}`);
      return;
    }

    if (receipt) {
      setReceiptGroups((current) => ({
        ...current,
        [vendorId]: [receipt, ...(current[vendorId] ?? [])],
      }));
    }
    setMessage("Struk vendor berhasil diupload.");
  }

  return (
    <div className="admin-vendor-list">
      {message ? <div className="alert">{message}</div> : null}
      {groups.map((group) => (
        <section className="panel admin-vendor-group" key={group.vendorId}>
          <div className="admin-vendor-head">
            <div>
              <p className="eyebrow">Vendor</p>
              <h2>{group.vendorName}</h2>
              <p className="muted">{group.items.length} item request</p>
            </div>
            <label className="button outline upload-button">
              {uploadingVendorId === group.vendorId ? "Uploading..." : "Upload Struk"}
              <input
                accept="image/*,.pdf"
                disabled={uploadingVendorId === group.vendorId}
                multiple
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  void files.reduce(
                    (promise, file) => promise.then(() => uploadReceipt(group.vendorId, file)),
                    Promise.resolve(),
                  );
                  event.target.value = "";
                }}
                type="file"
              />
            </label>
          </div>

          <div className="receipt-list">
            {(receiptGroups[group.vendorId] ?? []).map((receipt) => (
              <a href={receipt.receipt_url} key={receipt.id} target="_blank">
                {receipt.file_name ?? "Struk"} <span>{new Date(receipt.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span>
              </a>
            ))}
            {(receiptGroups[group.vendorId] ?? []).length === 0 ? <span className="muted">Belum ada struk untuk tanggal ini.</span> : null}
          </div>

          <div className="table-wrap admin-vendor-table-wrap">
            <table className="admin-vendor-table">
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Store</th>
                  <th>Barang</th>
                  <th>Qty Req</th>
                  <th>Qty Beli</th>
                  <th>Harga</th>
                  <th>Harga Kemarin</th>
                  <th>Status</th>
                  <th>Catatan</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {group.items.map((item) => {
                  const previousPrice = priceMap.get(`${item.product_id}:${item.vendor_id}`);
                  return (
                    <tr key={item.id}>
                      <td>
                        {item.purchase_requests?.request_no ?? "-"}
                        <br />
                        <span className="muted">Batch {item.purchase_requests?.batch_no ?? "-"}</span>
                      </td>
                      <td>{item.purchase_requests?.store_name ?? "-"}</td>
                      <td>{productDisplayName(item.products)}</td>
                      <td>
                        {item.qty} {item.unit}
                      </td>
                      <td>
                        <input form={`vendor-item-${item.id}`} min="0" name="purchased_qty" step="0.01" type="number" defaultValue={item.purchased_qty ?? item.qty} />
                      </td>
                      <td>
                        <input form={`vendor-item-${item.id}`} min="0" name="purchase_price" step="0.01" type="number" defaultValue={item.purchase_price ?? ""} placeholder="0" />
                      </td>
                      <td>{formatPrice(previousPrice)}</td>
                      <td>
                        <select form={`vendor-item-${item.id}`} name="status" defaultValue={item.status}>
                          {statuses.map((status) => (
                            <option key={status} value={status}>
                              {status.replaceAll("_", " ")}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input form={`vendor-item-${item.id}`} name="vendor_note" defaultValue={item.vendor_note ?? ""} placeholder="Catatan" />
                      </td>
                      <td>
                        <form action={saveAdminVendorItem} id={`vendor-item-${item.id}`}>
                          <input name="item_id" type="hidden" value={item.id} />
                          <input name="product_id" type="hidden" value={item.product_id} />
                          <input name="vendor_id" type="hidden" value={item.vendor_id} />
                          <SaveButton />
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      {groups.length === 0 ? (
        <section className="panel">
          <h2>Belum ada data</h2>
          <p className="muted">Tidak ada item vendor untuk filter yang dipilih.</p>
        </section>
      ) : null}
    </div>
  );
}
