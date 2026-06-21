"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function ResponsiveTables() {
  const pathname = usePathname();

  useEffect(() => {
    const tables = document.querySelectorAll<HTMLTableElement>("table");

    tables.forEach((table) => {
      const headers = Array.from(table.querySelectorAll("thead th")).map((header) => header.textContent?.trim() ?? "");
      table.querySelectorAll<HTMLTableRowElement>("tbody tr").forEach((row) => {
        Array.from(row.children).forEach((cell, index) => {
          if (cell instanceof HTMLElement) {
            cell.dataset.label = headers[index] ?? "";
          }
        });
      });
    });
  }, [pathname]);

  return null;
}
