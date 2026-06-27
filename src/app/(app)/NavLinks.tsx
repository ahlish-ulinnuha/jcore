"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

export function NavLinks({ allowedMenuKeys, role }: { allowedMenuKeys: string[]; role: Role }) {
  const pathname = usePathname();
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
  const visibleTopLinks = role === "admin"
    ? visibleMainLinks.filter((link) => !adminReportMenu.some((item) => item.key === link.key))
    : visibleMainLinks;

  return (
    <>
      {visibleTopLinks.map((link) => (
          <Link className={isActive(pathname, link.href) ? "active" : undefined} href={link.href} key={link.href}>
            {link.label}
          </Link>
        ))}
      {visibleAdminReportLinks.length ? (
        <div className="nav-dropdown">
          <Link className={visibleAdminReportLinks.some((link) => isActive(pathname, link.href)) ? "active" : undefined} href={visibleAdminReportLinks[0].href}>
            Report
          </Link>
          <div className="nav-dropdown-menu">
            {visibleAdminReportLinks.map((link) => (
              <Link className={isActive(pathname, link.href) ? "active" : undefined} href={link.href} key={link.href}>
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
      {role === "admin" && hasAnyMasterMenuAccess(allowedMenuKeys) ? (
        <div className="nav-dropdown">
          <Link className={pathname.startsWith("/admin/master") ? "active" : undefined} href="/admin/master">
            Master Data
          </Link>
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
