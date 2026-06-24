"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/types";

const links: Array<{ href: string; label: string; roles: Role[] }> = [
  { href: "/dashboard", label: "Dashboard", roles: ["admin", "staff"] },
  { href: "/requests/new", label: "Request Baru", roles: ["admin", "staff"] },
  { href: "/reports/daily", label: "Report Harian", roles: ["admin", "staff"] },
  { href: "/reports/spices", label: "Report Bumbu", roles: ["admin", "staff"] },
  { href: "/reports/sales", label: "Report Sales", roles: ["admin", "staff"] },
  { href: "/admin/vendor", label: "Vendor", roles: ["admin"] },
  { href: "/vendor", label: "Vendor", roles: ["vendor"] },
];

const masterLinks = [
  { href: "/admin/master/barang", label: "Barang" },
  { href: "/admin/master/store", label: "Store" },
  { href: "/admin/master/brand", label: "Brand" },
  { href: "/admin/master/mapping-vendor", label: "Mapping Vendor" },
  { href: "/admin/master/alias-vendor", label: "Alias Vendor" },
  { href: "/admin/master/harga-vendor", label: "Harga Vendor" },
  { href: "/admin/master/user", label: "User" },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  if (href === "/requests/new") return pathname.startsWith("/requests");
  return pathname.startsWith(href);
}

export function NavLinks({ role }: { role: Role }) {
  const pathname = usePathname();

  return (
    <>
      {links
        .filter((link) => link.roles.includes(role))
        .map((link) => (
          <Link className={isActive(pathname, link.href) ? "active" : undefined} href={link.href} key={link.href}>
            {link.label}
          </Link>
        ))}
      {role === "admin" ? (
        <div className="nav-dropdown">
          <Link className={pathname.startsWith("/admin/master") ? "active" : undefined} href="/admin/master">
            Master Data
          </Link>
          <div className="nav-dropdown-menu">
            {masterLinks.map((link) => (
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
