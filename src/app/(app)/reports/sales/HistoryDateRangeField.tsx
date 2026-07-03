"use client";

import { useEffect, useRef, useState } from "react";

function formatDisplayDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function displayLabel(from: string, to: string) {
  if (!from && !to) return "";
  if (from && to) return `${formatDisplayDate(from)} s/d ${formatDisplayDate(to)}`;
  return formatDisplayDate(from || to);
}

export function HistoryDateRangeField({
  defaultFrom,
  defaultTo,
  label,
  nameFrom,
  nameTo,
}: {
  defaultFrom: string;
  defaultTo: string;
  label: string;
  nameFrom: string;
  nameTo: string;
}) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="field date-range-field" ref={containerRef}>
      <label>{label}</label>
      <input name={nameFrom} type="hidden" value={from} />
      <input name={nameTo} type="hidden" value={to} />
      <button className="date-range-trigger" onClick={() => setOpen((current) => !current)} type="button">
        {displayLabel(from, to) || "Pilih tanggal"}
      </button>
      {open ? (
        <div className="date-range-popover">
          <div className="field">
            <label>Dari</label>
            <input onChange={(event) => setFrom(event.target.value)} type="date" value={from} />
          </div>
          <div className="field">
            <label>Sampai</label>
            <input onChange={(event) => setTo(event.target.value)} type="date" value={to} />
          </div>
          <button className="button primary" onClick={() => setOpen(false)} type="button">
            Terapkan
          </button>
        </div>
      ) : null}
    </div>
  );
}
