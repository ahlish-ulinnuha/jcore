"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import type { Profile, Store } from "@/lib/types";
import { saveShoppingRecord } from "./actions";

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    currency: "IDR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button className={`button primary ${pending ? "saving" : ""}`} disabled={pending} type="submit">
      {pending ? "Menyimpan..." : "Simpan Belanja"}
    </button>
  );
}

export function ShoppingRecordForm({
  categoryOptions,
  profile,
  recordDate,
  selectedStoreId,
  stores,
}: {
  categoryOptions: string[];
  profile: Profile;
  recordDate: string;
  selectedStoreId: string;
  stores: Store[];
}) {
  const [total, setTotal] = useState(0);
  const defaultCategory = categoryOptions.includes("belanja") ? "belanja" : categoryOptions[0] ?? "belanja";

  return (
    <form action={saveShoppingRecord} className="form shopping-form">
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
        <input name="description" placeholder="Contoh: mekar" required />
      </div>
      <div className="field">
        <label>Total Belanja</label>
        <input
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
        <select name="payment_method" defaultValue="cash">
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
        <label>Catatan</label>
        <input name="notes" placeholder="Opsional" />
      </div>

      <div className="row-actions">
        <SaveButton />
      </div>
    </form>
  );
}
