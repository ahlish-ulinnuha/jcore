"use client";

import { useFormStatus } from "react-dom";
import type { PurchaseRequest } from "@/lib/types";
import { updatePurchaseRequestStatus } from "../requests/actions";

function StatusButton() {
  const { pending } = useFormStatus();
  return (
    <button className={`button outline ${pending ? "saving" : ""}`} disabled={pending} type="submit">
      {pending ? "Menyimpan..." : "Ubah"}
    </button>
  );
}

export function RequestStatusForm({
  currentPath,
  request,
}: {
  currentPath: string;
  request: PurchaseRequest;
}) {
  return (
    <form action={updatePurchaseRequestStatus} className="request-status-form">
      <input name="id" type="hidden" value={request.id} />
      <input name="redirect_to" type="hidden" value={currentPath} />
      <select aria-label={`Status ${request.request_no}`} name="status" defaultValue={request.status}>
        <option value="draft">draft</option>
        <option value="submitted">submitted</option>
        <option value="cancelled">cancelled</option>
      </select>
      <StatusButton />
    </form>
  );
}
