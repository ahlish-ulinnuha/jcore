"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

type Variant = "danger" | "outline" | "primary";

export function MasterSubmitButton({
  className = "",
  disabled = false,
  form,
  label,
  pendingLabel,
  title,
  variant = "outline",
}: {
  className?: string;
  disabled?: boolean;
  form?: string;
  label: string;
  pendingLabel: string;
  title?: string;
  variant?: Variant;
}) {
  const { pending } = useFormStatus();
  const [clicked, setClicked] = useState(false);
  const isPending = pending || clicked;

  useEffect(() => {
    if (!clicked) return;
    const timeoutId = window.setTimeout(() => setClicked(false), 1800);
    return () => window.clearTimeout(timeoutId);
  }, [clicked]);

  return (
    <button
      className={`button ${variant} ${isPending ? "saving" : ""} ${className}`.trim()}
      disabled={disabled || isPending}
      form={form}
      onClick={(event) => {
        const targetForm = event.currentTarget.form;
        if (targetForm && !targetForm.checkValidity()) return;
        window.setTimeout(() => setClicked(true), 0);
      }}
      title={title}
      type="submit"
    >
      {isPending ? pendingLabel : label}
    </button>
  );
}
