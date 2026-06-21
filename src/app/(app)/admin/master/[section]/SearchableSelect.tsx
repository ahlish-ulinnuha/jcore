"use client";

import { useMemo, useState } from "react";

export function SearchableSelect({
  label,
  name,
  options,
}: {
  label: string;
  name: string;
  options: Array<{ label: string; value: string }>;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(options[0]?.value ?? "");
  const selected = options.find((option) => option.value === value);
  const filtered = useMemo(
    () => options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase())),
    [options, query],
  );

  function selectOption(nextValue: string) {
    setValue(nextValue);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="field">
      <label>{label}</label>
      <input name={name} type="hidden" value={value} />
      <div
        className="combo"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setOpen(false);
            setQuery("");
          }
        }}
      >
        <button className="combo-trigger" onClick={() => setOpen((current) => !current)} type="button">
          <span>{selected?.label ?? "Pilih data"}</span>
          <span aria-hidden="true">⌄</span>
        </button>
        {open ? (
          <div className="combo-menu">
            <input autoFocus onChange={(event) => setQuery(event.target.value)} placeholder="Cari..." value={query} />
            <div className="combo-options">
              {filtered.map((option) => (
                <button
                  key={option.value}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    selectOption(option.value);
                  }}
                  onTouchStart={() => selectOption(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
              {filtered.length === 0 ? <div className="combo-empty">Data tidak ditemukan</div> : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
