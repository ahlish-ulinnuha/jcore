"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import type { DailySalesReport, Profile, Store } from "@/lib/types";
import { saveDailySalesReport } from "./actions";

const denominations = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100] as const;

type CashKey = `cash_${typeof denominations[number]}`;
type CashCounts = Record<CashKey, number>;

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    currency: "IDR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function initialCash(report: DailySalesReport | null): CashCounts {
  return Object.fromEntries(
    denominations.map((denomination) => [`cash_${denomination}`, Number(report?.[`cash_${denomination}` as CashKey] ?? 0)]),
  ) as CashCounts;
}

function selectZero(event: React.FocusEvent<HTMLInputElement>) {
  if (event.currentTarget.value === "0") {
    event.currentTarget.select();
  }
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button className={`button primary ${pending ? "saving" : ""}`} disabled={pending} type="submit">
      {pending ? "Menyimpan..." : "Simpan Report Sales"}
    </button>
  );
}

export function SalesReportForm({
  profile,
  report,
  reportDate,
  selectedStoreId,
  stores,
}: {
  profile: Profile;
  report: DailySalesReport | null;
  reportDate: string;
  selectedStoreId: string;
  stores: Store[];
}) {
  const searchParams = useSearchParams();
  const justSaved = searchParams.get("saved") === "1";
  const effectiveReport = justSaved ? null : report;

  const [systemNominal, setSystemNominal] = useState(Number(effectiveReport?.system_nominal ?? 0));
  const [cashCounts, setCashCounts] = useState<CashCounts>(() => initialCash(effectiveReport));
  const [qris, setQris] = useState(Number(effectiveReport?.qris ?? 0));
  const [debit, setDebit] = useState(Number(effectiveReport?.debit ?? 0));
  const [shopee, setShopee] = useState(Number(effectiveReport?.shopee ?? 0));
  const [grab, setGrab] = useState(Number(effectiveReport?.grab ?? 0));
  const [gojek, setGojek] = useState(Number(effectiveReport?.gojek ?? 0));
  const [expense, setExpense] = useState(Number(effectiveReport?.expense ?? 0));

  const cashTotal = useMemo(
    () => denominations.reduce((total, denomination) => total + cashCounts[`cash_${denomination}`] * denomination, 0),
    [cashCounts],
  );
  const difference = cashTotal + qris + debit + shopee + grab + gojek + expense - systemNominal;

  function updateCash(denomination: typeof denominations[number], value: string) {
    const count = Math.max(0, Math.floor(Number(value) || 0));
    setCashCounts((current) => ({ ...current, [`cash_${denomination}`]: count }));
  }

  return (
    <form action={saveDailySalesReport} className="form sales-report-form">
      <div className="filter-grid">
        <div className="field">
          <label>Tanggal</label>
          <input name="report_date" type="date" defaultValue={reportDate} required />
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
      </div>

      <div className="sales-layout">
        <section className="sales-card">
          <h2>Nominal System</h2>
          <div className="field">
            <label>Nominal System</label>
            <input
              min="0"
              name="system_nominal"
              onChange={(event) => setSystemNominal(Number(event.target.value) || 0)}
              onFocus={selectZero}
              step="1"
              type="number"
              value={systemNominal}
            />
          </div>
          <div className="sales-total-card">
            <span>Total Input</span>
            <strong>{formatRupiah(cashTotal + qris + debit + shopee + grab + gojek + expense)}</strong>
          </div>
          <div className={`sales-total-card ${difference === 0 ? "balanced" : difference > 0 ? "plus" : "minus"}`}>
            <span>Selisih</span>
            <strong>{formatRupiah(difference)}</strong>
          </div>
        </section>

        <section className="sales-card">
          <h2>Rincian Tunai</h2>
          <div className="cash-denomination-grid">
            {denominations.map((denomination) => (
              <div className="field cash-denomination" key={denomination}>
                <label>{denomination.toLocaleString("id-ID")}</label>
                <input
                  min="0"
                  name={`cash_${denomination}`}
                  onChange={(event) => updateCash(denomination, event.target.value)}
                  onFocus={selectZero}
                  step="1"
                  type="number"
                  value={cashCounts[`cash_${denomination}`]}
                />
              </div>
            ))}
          </div>
          <div className="sales-total-card compact">
            <span>Tunai</span>
            <strong>{formatRupiah(cashTotal)}</strong>
          </div>
        </section>
      </div>

      <div className="sales-payment-grid">
        <div className="field">
          <label>Qris</label>
          <input min="0" name="qris" onChange={(event) => setQris(Number(event.target.value) || 0)} onFocus={selectZero} step="1" type="number" value={qris} />
        </div>
        <div className="field">
          <label>Debit</label>
          <input min="0" name="debit" onChange={(event) => setDebit(Number(event.target.value) || 0)} onFocus={selectZero} step="1" type="number" value={debit} />
        </div>
        <div className="field">
          <label>Shopee</label>
          <input min="0" name="shopee" onChange={(event) => setShopee(Number(event.target.value) || 0)} onFocus={selectZero} step="1" type="number" value={shopee} />
        </div>
        <div className="field">
          <label>Grab</label>
          <input min="0" name="grab" onChange={(event) => setGrab(Number(event.target.value) || 0)} onFocus={selectZero} step="1" type="number" value={grab} />
        </div>
        <div className="field">
          <label>Gojek</label>
          <input min="0" name="gojek" onChange={(event) => setGojek(Number(event.target.value) || 0)} onFocus={selectZero} step="1" type="number" value={gojek} />
        </div>
        <div className="field">
          <label>Pengeluaran</label>
          <input min="0" name="expense" onChange={(event) => setExpense(Number(event.target.value) || 0)} onFocus={selectZero} step="1" type="number" value={expense} />
        </div>
      </div>

      <div className="field">
        <label>Rincian Pengeluaran</label>
        <textarea defaultValue={effectiveReport?.expense_detail ?? ""} name="expense_detail" placeholder="Contoh: beli plastik, parkir, dll" rows={3} />
      </div>

      <div className="field">
        <label>Note</label>
        <textarea defaultValue={effectiveReport?.notes ?? ""} name="notes" placeholder="Alasan jika ada selisih plus/minus" rows={3} />
      </div>

      <div className="row-actions">
        <SaveButton />
      </div>
    </form>
  );
}
