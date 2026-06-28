"use client";

import { useFormStatus } from "react-dom";

export function ScheduleSubmitButton({
  className = "button primary",
  disabled = false,
  idleText,
  name,
  pendingText = "Sedang memproses...",
  value,
}: {
  className?: string;
  disabled?: boolean;
  idleText: string;
  name?: string;
  pendingText?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button className={`${className} ${pending ? "saving" : ""}`} disabled={pending || disabled} name={name} type="submit" value={value}>
      {pending ? pendingText : idleText}
    </button>
  );
}
