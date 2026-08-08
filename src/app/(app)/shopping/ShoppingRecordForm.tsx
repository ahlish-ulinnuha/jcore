"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import type { Profile, ShoppingRecord, Store } from "@/lib/types";
import { saveShoppingRecord } from "./actions";

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    currency: "IDR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function SaveButton({ isEditing }: { isEditing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className={`button primary ${pending ? "saving" : ""}`} disabled={pending} type="submit">
      {pending ? "Menyimpan..." : isEditing ? "Update Belanja" : "Simpan Belanja"}
    </button>
  );
}

export function ShoppingRecordForm({
  categoryOptions,
  editingRecord,
  profile,
  recordDate,
  selectedStoreId,
  stores,
}: {
  categoryOptions: string[];
  editingRecord?: ShoppingRecord | null;
  profile: Profile;
  recordDate: string;
  selectedStoreId: string;
  stores: Store[];
}) {
  const [total, setTotal] = useState(Number(editingRecord?.total_price ?? 0));
  const defaultCategory = editingRecord?.category ?? (categoryOptions.includes("belanja") ? "belanja" : categoryOptions[0] ?? "belanja");

  return (
    <form action={saveShoppingRecord} className="form shopping-form">
      {editingRecord ? <input name="id" type="hidden" value={editingRecord.id} /> : null}
      <div className="field">
        <label>Tanggal Belanja</label>
        <input name="record_date" type="date" defaultValue={recordDate} required />
      </div>
      {profile.role === "admin" ? (
        <div className="field">
          <label>Store</label>
          <select name="store_id" defaultValue={selectedStoreId} required>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <>
          <input name="store_id" type="hidden" value={selectedStoreId} />
          <div className="field">
            <label>Store</label>
            <input disabled value={profile.stores?.name ?? profile.store_name ?? "-"} />
          </div>
        </>
      )}
      <div className="field">
        <label>Deskripsi</label>
        <input defaultValue={editingRecord?.description ?? ""} name="description" placeholder="Contoh: mekar" required />
      </div>
      <div className="field">
        <label>Total Belanja</label>
        <input
          defaultValue={editingRecord?.total_price ?? undefined}
          min="0"
          name="total_price"
          onChange={(event) => setTotal(Number(event.target.value) || 0)}
          placeholder="0"
          required
          step="1"
          type="number"
        />
      </div>
      <div className="field">
        <label>Kategori</label>
        <select name="category" defaultValue={defaultCategory} required>
          {categoryOptions.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>
      <div className="shopping-total-card">
        <span>Total Belanja</span>
        <strong>{formatRupiah(total)}</strong>
      </div>
      <div className="field">
        <label>Metode Pembayaran</label>
        <select defaultValue={editingRecord?.payment_method ?? "cash"} name="payment_method">
          <option value="cash">Cash</option>
          <option value="qris">QRIS</option>
          <option value="debit">Debit</option>
          <option value="kartu kredit">Kartu Kredit</option>
          <option value="shopee">Shopee</option>
          <option value="transfer">Transfer</option>
          <option value="other">Lainnya</option>
        </select>
      </div>
      <div className="field">
        <label>Status Pembayaran</label>
        <select defaultValue={editingRecord?.payment_status ?? "paid"} name="payment_status">
          <option value="unpaid">Unpaid</option>
          <option value="paid">Paid</option>
        </select>
      </div>
      <div className="field">
        <label>Catatan</label>
        <input defaultValue={editingRecord?.notes ?? ""} name="notes" placeholder="Opsional" />
      </div>

      <div className="row-actions">
        <SaveButton isEditing={Boolean(editingRecord)} />
        {editingRecord ? (
          <Link className="button outline" href="/shopping">
            Batal Edit
          </Link>
        ) : null}
      </div>
    </form>
  );
}
