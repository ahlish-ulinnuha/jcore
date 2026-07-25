"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { productDisplayName } from "@/lib/format";
import type { ActivityLog, Product, PurchaseRequest, PurchaseRequestItem } from "@/lib/types";

type DraftItem = {
  productId: string;
  vendorId: string;
  qty: string;
  unit: string;
};

type ProductPickerProps = {
  disabled: boolean;
  onChange: (productId: string) => void;
  products: Product[];
  value: string;
};

type Toast = {
  text: string;
  tone: "draft" | "submit" | "delete";
};

type ActiveRequest = Pick<PurchaseRequest, "batch_no" | "id" | "request_no" | "status" | "updated_at">;

function todayJakarta() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function tomorrowJakarta() {
  const [year, month, day] = todayJakarta().split("-").map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  utcDate.setUTCDate(utcDate.getUTCDate() + 1);
  return utcDate.toISOString().slice(0, 10);
}

function productLabel(product: Product) {
  const sku = product.sku ? `${product.sku} - ` : "";
  return `${sku}${productDisplayName(product)}`;
}

function ProductPicker({ disabled, onChange, products, value }: ProductPickerProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selectedProduct = products.find((product) => product.id === value);
  const filteredProducts = products.filter((product) => productLabel(product).toLowerCase().includes(query.toLowerCase()));
  function selectProduct(productId: string) {
    onChange(productId);
    setQuery("");
    setOpen(false);
  }

  return (
    <div
      className="combo"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
          setQuery("");
        }
      }}
    >
      <button
        className="combo-trigger"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span>{selectedProduct ? productLabel(selectedProduct) : "Pilih barang"}</span>
        <span aria-hidden="true">⌄</span>
      </button>
      {open ? (
        <div className="combo-menu">
          <input
            autoFocus
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari barang..."
            value={query}
          />
          <div className="combo-options">
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                onMouseDown={(event) => {
                  event.preventDefault();
                  selectProduct(product.id);
                }}
                onTouchStart={() => selectProduct(product.id)}
                type="button"
              >
                {productLabel(product)}
              </button>
            ))}
            {filteredProducts.length === 0 ? <div className="combo-empty">Barang tidak ditemukan</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function mappedVendorId(product?: Product) {
  return product?.product_vendors?.find((mapping) => mapping.is_default)?.vendor_id ?? product?.product_vendors?.[0]?.vendor_id ?? "";
}

function emptyItem(): DraftItem {
  return {
    productId: "",
    vendorId: "",
    qty: "1",
    unit: "pcs",
  };
}

function initialItems(requestItems?: PurchaseRequestItem[]): DraftItem[] {
  if (requestItems?.length) {
    return requestItems.map((item) => ({
      productId: item.product_id,
      vendorId: item.vendor_id,
      qty: String(item.qty),
      unit: item.unit,
    }));
  }

  return [emptyItem()];
}

export function NewRequestForm({
  products,
  profileName,
  userId,
  storeId,
  storeName,
  request,
  requestItems,
  activityLogs = [],
}: {
  activityLogs?: ActivityLog[];
  products: Product[];
  profileName: string;
  userId: string;
  storeId: string | null;
  storeName: string;
  request?: PurchaseRequest;
  requestItems?: PurchaseRequestItem[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [requestDate, setRequestDate] = useState(request?.request_date ?? todayJakarta());
  const [notes, setNotes] = useState(request?.notes ?? "");
  const [items, setItems] = useState<DraftItem[]>(initialItems(requestItems));
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [activeRequest, setActiveRequest] = useState<ActiveRequest | undefined>(request);

  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const isSubmitted = activeRequest?.status === "submitted";

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function showToast(nextToast: Toast) {
    setToast(nextToast);
  }

  function queueToast(nextToast: Toast) {
    sessionStorage.setItem("request-toast", JSON.stringify(nextToast));
  }

  function updateItem(index: number, patch: Partial<DraftItem>) {
    setItems((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const next = { ...item, ...patch };
        if (patch.productId) {
          const product = productById.get(patch.productId);
          next.unit = product?.unit ?? next.unit;
          next.vendorId = mappedVendorId(product);
        }
        return next;
      }),
    );
  }

  function availableProducts(index: number) {
    const selected = new Set(items.map((item, itemIndex) => (itemIndex === index ? "" : item.productId)).filter(Boolean));
    return products.filter((product) => !selected.has(product.id));
  }

  async function nextBatchNo() {
    const queries = [
      supabase
        .from("purchase_requests")
        .select("batch_no")
        .eq("request_date", requestDate)
        .eq("store_name", storeName)
        .order("batch_no", { ascending: false })
        .limit(1),
    ];

    if (storeId) {
      queries.push(
        supabase
          .from("purchase_requests")
          .select("batch_no")
          .eq("request_date", requestDate)
          .eq("store_id", storeId)
          .order("batch_no", { ascending: false })
          .limit(1),
      );
    }

    const results = await Promise.all(queries);
    const maxBatch = Math.max(
      0,
      ...results.map((result) => Number(result.data?.[0]?.batch_no ?? 0)),
    );

    return maxBatch + 1;
  }

  async function persistRequest(status: "draft" | "submitted") {
    if (saving) return;
    setSaving(true);
    setMessage("");

    const selectedItems = items.filter((item) => item.productId && Number(item.qty) > 0);
    const unmappedItem = selectedItems.find((item) => !item.vendorId);
    if (unmappedItem) {
      setMessage("Barang yang dipilih belum memiliki mapping vendor. Mohon admin lengkapi mapping barang ke vendor.");
      setSaving(false);
      return;
    }

    const validItems = selectedItems.filter((item) => item.vendorId);
    if (validItems.length === 0) {
      setMessage("Minimal isi satu item request.");
      setSaving(false);
      return;
    }

    const batchNo = activeRequest?.batch_no ?? (await nextBatchNo());
    const requestNo = activeRequest?.request_no ?? `PR-${requestDate.replaceAll("-", "")}-${storeName.replace(/\s+/g, "").slice(0, 8).toUpperCase()}-${batchNo}`;
    const payload = {
      request_no: requestNo,
      request_date: requestDate,
      batch_no: batchNo,
      status,
      store_id: storeId,
      store_name: storeName,
      notes,
    };

    const { data: savedRequest, error: requestError } = activeRequest?.id
      ? await supabase
          .from("purchase_requests")
          .update(payload)
          .eq("id", activeRequest.id)
          .eq("updated_at", activeRequest.updated_at)
          .select("id, request_no, batch_no, status, updated_at")
          .maybeSingle<ActiveRequest>()
      : await supabase
          .from("purchase_requests")
          .insert({ ...payload, created_by: userId })
          .select("id, request_no, batch_no, status, updated_at")
          .single<ActiveRequest>();

    if (requestError || !savedRequest) {
      setMessage(
        requestError?.message ??
          "Draft ini sudah diubah user lain. Refresh halaman dulu supaya data terbaru tidak tertimpa.",
      );
      setSaving(false);
      return;
    }

    if (activeRequest?.id) {
      const { error: deleteError } = await supabase.from("purchase_request_items").delete().eq("request_id", activeRequest.id);
      if (deleteError) {
        setMessage(deleteError.message);
        setSaving(false);
        return;
      }
    }

    const { error: itemError } = await supabase.from("purchase_request_items").insert(
      validItems.map((item) => ({
        request_id: savedRequest.id,
        product_id: item.productId,
        vendor_id: item.vendorId,
        qty: Number(item.qty),
        unit: item.unit,
      })),
    );

    setSaving(false);

    if (itemError) {
      setMessage(itemError.message);
      return;
    }

    setActiveRequest(savedRequest);
    await supabase.from("activity_logs").insert({
      entity_type: "purchase_request",
      entity_id: savedRequest.id,
      action: activeRequest?.id ? (status === "submitted" ? "submit_request" : "update_draft") : "create_draft",
      actor_id: userId,
      actor_name: profileName,
      details: {
        batch_no: savedRequest.batch_no,
        item_count: validItems.length,
        request_no: savedRequest.request_no,
        status,
      },
    });

    const successToast: Toast =
      status === "submitted"
        ? { text: "Request berhasil disubmit dan dikirim ke vendor.", tone: "submit" }
        : { text: "Draft purchase request berhasil disimpan.", tone: "draft" };

    if (status === "submitted") {
      queueToast(successToast);
      router.replace("/dashboard");
      router.refresh();
      return;
    }

    showToast(successToast);
    if (!activeRequest?.id) {
      queueToast(successToast);
      router.replace(`/requests/${savedRequest.id}/edit`);
      router.refresh();
      return;
    }

    router.refresh();
  }

  async function saveRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await persistRequest("draft");
  }

  async function submitRequest() {
    const batchNo = activeRequest?.batch_no ?? (await nextBatchNo());
    const dayLabel = requestDate === todayJakarta() ? "HARI INI" : requestDate === tomorrowJakarta() ? "BESOK" : requestDate;
    const confirmed = window.confirm(`Request ini untuk ${dayLabel} (${requestDate}), Batch ${batchNo}.\n\nLanjutkan submit?`);
    if (!confirmed) return;
    await persistRequest("submitted");
  }

  return (
    <form className="form panel" onSubmit={saveRequest}>
      {toast ? <div className={`toast ${toast.tone}`}>{toast.text}</div> : null}
      {message ? <div className="alert">{message}</div> : null}
      <div className="grid cols-3">
        <div className="field">
          <label htmlFor="requestDate">Tanggal request</label>
          <input
            id="requestDate"
            type="date"
            min={todayJakarta()}
            value={requestDate}
            onChange={(event) => setRequestDate(event.target.value)}
            disabled={isSubmitted}
          />
        </div>
        <div className="field">
          <label>Store</label>
          <input value={storeName} disabled />
        </div>
        <div className="field">
          <label>Batch</label>
          <input value={activeRequest?.batch_no ? `Batch ${activeRequest.batch_no}` : "Otomatis saat simpan"} disabled />
        </div>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label htmlFor="notes">Catatan</label>
          <input id="notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Opsional" disabled={isSubmitted} />
        </div>
      </div>

      <div className="table-wrap request-items-table">
        <table>
          <thead>
            <tr>
              <th>Barang</th>
              <th>Qty</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={`${index}-${item.productId}`}>
                <td>
                  <ProductPicker
                    disabled={isSubmitted}
                    onChange={(productId) => updateItem(index, { productId })}
                    products={availableProducts(index)}
                    value={item.productId}
                  />
                </td>
                <td>
                  <input min="0.01" step="0.01" type="number" value={item.qty} onChange={(event) => updateItem(index, { qty: event.target.value })} disabled={isSubmitted} />
                </td>
                <td>
                  <button
                    className="button danger"
                    type="button"
                    onClick={() => {
                      setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
                      showToast({ text: "Item berhasil dihapus dari draft.", tone: "delete" });
                    }}
                    disabled={isSubmitted}
                  >
                    Hapus
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="row-actions">
        <button
          className="button outline"
          type="button"
          disabled={isSubmitted || items.filter((item) => item.productId).length >= products.length}
          onClick={() =>
            setItems((current) => [
              ...current,
              emptyItem(),
            ])
          }
        >
          Tambah Item
        </button>
        <button className="button outline" type="submit" disabled={saving || isSubmitted}>
          {saving ? "Menyimpan..." : "Simpan Draft"}
        </button>
        <button className="button soft-primary" type="button" disabled={saving || isSubmitted} onClick={submitRequest}>
          Submit Request
        </button>
      </div>
      {activityLogs.length ? (
        <section className="activity-history">
          <h2>History perubahan draft</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>User</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {activityLogs.map((log) => (
                  <tr key={log.id}>
                    <td>{new Date(log.created_at).toLocaleString("id-ID")}</td>
                    <td>{log.actor_name ?? "-"}</td>
                    <td>{log.action.replaceAll("_", " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </form>
  );
}
