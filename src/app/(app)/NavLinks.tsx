"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { hasAnyMasterMenuAccess, hasMenuAccess, mainMenuItems, masterMenuItems } from "@/lib/menu-access";
import type { Role } from "@/lib/types";

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  if (href === "/requests/new") return pathname.startsWith("/requests");
  return pathname.startsWith(href);
}

const adminReportMenu = [
  { key: "report_daily", label: "Report Harian" },
  { key: "report_spices", label: "Report Bumbu" },
  { key: "report_sales", label: "Report Sales" },
  { key: "shopping", label: "Report Belanja" },
  { key: "admin_vendor", label: "Report Vendor" },
];

const operationalMenu = [
  { key: "attendance", label: "Absensi" },
  { key: "schedules", label: "Schedule", staffLabel: "My Schedule" },
  { key: "all_schedules", label: "All Schedule" },
  { key: "schedule_requests", label: "Request Schedule" },
  { adminOnly: true, key: "overtime_summary", label: "Overtime Summary" },
];

export function NavLinks({ allowedMenuKeys, role }: { allowedMenuKeys: string[]; role: Role }) {
  const pathname = usePathname();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const visibleMainLinks = mainMenuItems.filter((link) => hasMenuAccess(link.key, allowedMenuKeys));
  const visibleMasterLinks = masterMenuItems.filter((link) => hasMenuAccess(link.key, allowedMenuKeys));
  const visibleAdminReportLinks = role === "admin"
    ? adminReportMenu
        .map((item) => {
          const link = mainMenuItems.find((menuItem) => menuItem.key === item.key);
          return link && hasMenuAccess(link.key, allowedMenuKeys) ? { ...link, label: item.label } : null;
        })
        .filter((link): link is NonNullable<typeof link> => Boolean(link))
    : [];
  const visibleOperationalLinks =
    role === "admin" || role === "staff"
      ? operationalMenu
        .filter((item) => !("adminOnly" in item) || role === "admin")
        .map((item) => {
          const link = mainMenuItems.find((menuItem) => menuItem.key === item.key);
          return link && hasMenuAccess(link.key, allowedMenuKeys) ? { ...link, label: role === "staff" && "staffLabel" in item ? item.staffLabel : item.label } : null;
        })
        .filter((link): link is NonNullable<typeof link> => Boolean(link))
      : [];
  const visibleTopLinks = role === "admin"
    ? visibleMainLinks.filter((link) => ![...adminReportMenu, ...operationalMenu].some((item) => item.key === link.key))
    : visibleMainLinks.filter((link) => !operationalMenu.some((item) => item.key === link.key));

  useEffect(() => {
    setOpenMenu(null);
  }, [pathname]);

  function toggleMenu(menu: string) {
    setOpenMenu((current) => (current === menu ? null : menu));
  }

  return (
    <>
      {visibleTopLinks.map((link) => (
          <Link className={isActive(pathname, link.href) ? "active" : undefined} href={link.href} key={link.href}>
            {link.label}
          </Link>
        ))}
      {visibleAdminReportLinks.length ? (
        <div className={`nav-dropdown ${openMenu === "report" ? "open" : ""}`}>
          <button aria-expanded={openMenu === "report"} className={visibleAdminReportLinks.some((link) => isActive(pathname, link.href)) ? "active" : undefined} onClick={() => toggleMenu("report")} type="button">
            Report
          </button>
          <div className="nav-dropdown-menu">
            {visibleAdminReportLinks.map((link) => (
              <Link className={isActive(pathname, link.href) ? "active" : undefined} href={link.href} key={link.href}>
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
      {visibleOperationalLinks.length ? (
        <div className={`nav-dropdown ${openMenu === "operational" ? "open" : ""}`}>
          <button aria-expanded={openMenu === "operational"} className={visibleOperationalLinks.some((link) => isActive(pathname, link.href)) ? "active" : undefined} onClick={() => toggleMenu("operational")} type="button">
            Operasional
          </button>
          <div className="nav-dropdown-menu">
            {visibleOperationalLinks.map((link) => (
              <Link className={isActive(pathname, link.href) ? "active" : undefined} href={link.href} key={link.href}>
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
      {role === "admin" && hasAnyMasterMenuAccess(allowedMenuKeys) ? (
        <div className={`nav-dropdown ${openMenu === "master" ? "open" : ""}`}>
          <button aria-expanded={openMenu === "master"} className={pathname.startsWith("/admin/master") ? "active" : undefined} onClick={() => toggleMenu("master")} type="button">
            Master Data
          </button>
          <div className="nav-dropdown-menu">
            {visibleMasterLinks.map((link) => (
              <Link className={pathname === link.href ? "active" : undefined} href={link.href} key={link.href}>
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}
