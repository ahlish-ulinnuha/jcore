"use client";

import { useState, useTransition } from "react";
import { sendVendorRequestMessage } from "./actions";

export function SendVendorMessageButton({
  batchNo,
  message,
  requestDate,
  vendorId,
}: {
  batchNo: number;
  message: string;
  requestDate: string;
  vendorId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ error?: string; ok: boolean } | null>(null);

  function send() {
    setResult(null);
    const formData = new FormData();
    formData.set("vendor_id", vendorId);
    formData.set("request_date", requestDate);
    formData.set("batch_no", String(batchNo));
    formData.set("message", message);
    startTransition(async () => {
      const response = await sendVendorRequestMessage(formData);
      setResult(response.ok ? { ok: true } : { error: response.error, ok: false });
    });
  }

  return (
    <div className="send-vendor-message">
      <button className={`button outline ${pending ? "saving" : ""}`} disabled={pending} onClick={send} type="button">
        {pending ? <span aria-hidden="true" className="button-spinner" /> : null}
        {pending ? "Mengirim..." : "Kirim ke Vendor"}
      </button>
      {result ? (
        <span className={`send-vendor-status ${result.ok ? "success" : "failed"}`}>
          {result.ok ? "Terkirim ke WhatsApp vendor." : `Gagal: ${result.error}`}
        </span>
      ) : null}
    </div>
  );
}
