import type { Role } from "./types";

export const mainMenuItems = [
  { href: "/dashboard", key: "dashboard", label: "Dashboard", roles: ["admin", "staff"] },
  { href: "/requests/new", key: "requests", label: "Request Baru", roles: ["admin", "staff"] },
  { href: "/reports/daily", key: "report_daily", label: "Report Harian", roles: ["admin", "staff"] },
  { href: "/reports/spices", key: "report_spices", label: "Report Bumbu", roles: ["admin", "staff"] },
  { href: "/reports/sales", key: "report_sales", label: "Report Sales", roles: ["admin", "staff"] },
  { href: "/shopping", key: "shopping", label: "Belanja", roles: ["admin", "staff"] },
  { href: "/attendance", key: "attendance", label: "Absensi", roles: ["admin", "staff"] },
  { href: "/schedules", key: "schedules", label: "Schedule", roles: ["admin", "staff"] },
  { href: "/schedules/requests", key: "schedule_requests", label: "Request Schedule", roles: ["admin"] },
  { href: "/overtime-summary", key: "overtime_summary", label: "Overtime Summary", roles: ["admin"] },
  { href: "/admin/vendor", key: "admin_vendor", label: "Vendor", roles: ["admin"] },
  { href: "/vendor", key: "vendor_portal", label: "Vendor", roles: ["vendor"] },
] as const;

export const masterMenuItems = [
  { href: "/admin/master/barang", key: "master_barang", label: "Barang", roles: ["admin"] },
  { href: "/admin/master/store", key: "master_store", label: "Store", roles: ["admin"] },
  { href: "/admin/master/brand", key: "master_brand", label: "Brand", roles: ["admin"] },
  { href: "/admin/master/mapping-vendor", key: "master_mapping_vendor", label: "Mapping Vendor", roles: ["admin"] },
  { href: "/admin/master/alias-vendor", key: "master_alias_vendor", label: "Alias Vendor", roles: ["admin"] },
  { href: "/admin/master/harga-vendor", key: "master_harga_vendor", label: "Harga Vendor", roles: ["admin"] },
  { href: "/admin/master/user", key: "master_user", label: "User", roles: ["admin"] },
] as const;

export const allMenuItems = [...mainMenuItems, ...masterMenuItems] as const;
export type MenuKey = (typeof allMenuItems)[number]["key"];

export type MenuAccessRowLike = {
  can_access: boolean;
  menu_key: string;
};

function roleAllowed(roles: readonly Role[], role: Role) {
  return roles.includes(role);
}

export function defaultMenuKeysForRole(role: Role) {
  return allMenuItems.filter((item) => roleAllowed(item.roles, role)).map((item) => item.key);
}

export function allowedMenuKeysForRole(role: Role, rows: MenuAccessRowLike[] = []) {
  const defaultKeys = defaultMenuKeysForRole(role);
  if (rows.length === 0) return defaultKeys;

  const accessByKey = new Map(rows.map((row) => [row.menu_key, row.can_access]));
  return defaultKeys.filter((key) => !accessByKey.has(key) || accessByKey.get(key) === true);
}

export function hasMenuAccess(key: string, allowedKeys: string[]) {
  return allowedKeys.includes(key);
}

export function hasAnyMasterMenuAccess(allowedKeys: string[]) {
  return masterMenuItems.some((item) => allowedKeys.includes(item.key));
}

export function firstAccessibleHref(role: Role, allowedKeys: string[]) {
  const menu = allMenuItems.find((item) => roleAllowed(item.roles, role) && allowedKeys.includes(item.key));
  return menu?.href ?? "/account/password";
}

export function menuKeyForPath(pathname: string) {
  const allItems = [...masterMenuItems, ...mainMenuItems];
  const match = allItems.find((item) => {
    if (item.href === "/dashboard") return pathname === item.href;
    if (item.href === "/requests/new") return pathname.startsWith("/requests");
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  });
  return match?.key ?? null;
}

export function canAccessPath(pathname: string, role: Role, allowedKeys: string[]) {
  if (pathname === "/" || pathname.startsWith("/login") || pathname.startsWith("/account/password")) return true;
  if (pathname === "/admin/master") return role === "admin" && hasAnyMasterMenuAccess(allowedKeys);

  const key = menuKeyForPath(pathname);
  if (!key || typeof key !== "string") return true;

  const item = allMenuItems.find((menuItem) => menuItem.key === key);
  return Boolean(item && roleAllowed(item.roles, role) && allowedKeys.includes(key));
}
