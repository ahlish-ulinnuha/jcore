export type Role = "admin" | "staff" | "vendor";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string;
  role: Role;
  store_id: string | null;
  store_name: string | null;
  stores?: Store | null;
};

export type Store = {
  id: string;
  name: string;
  code: string | null;
  is_active: boolean;
};

export type Vendor = {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  is_active: boolean;
};

export type Brand = {
  id: string;
  name: string;
  is_active: boolean;
};

export type Product = {
  id: string;
  brand_id: string | null;
  sku: string | null;
  name: string;
  unit: string;
  is_active: boolean;
  brands?: Brand | null;
  product_vendors?: ProductVendor[];
};

export type ProductVendor = {
  id: string;
  product_id: string;
  vendor_id: string;
  is_default: boolean;
  vendors?: Vendor | null;
};

export type PurchaseRequest = {
  id: string;
  request_no: string;
  request_date: string;
  batch_no: number;
  status: "draft" | "submitted" | "cancelled";
  store_id: string | null;
  store_name: string;
  notes: string | null;
  created_at: string;
  created_by: string;
  updated_at: string;
};

export type PurchaseRequestItem = {
  id: string;
  request_id: string;
  product_id: string;
  vendor_id: string;
  qty: number;
  unit: string;
  status: "requested" | "confirmed" | "unavailable" | "partially_available" | "fulfilled" | "cancelled";
  vendor_note: string | null;
  receipt_url: string | null;
  products?: Product | null;
  vendors?: Vendor | null;
  purchase_requests?: PurchaseRequest | null;
};

export type DailySpiceReport = {
  id: string;
  report_date: string;
  store_id: string;
  store_name: string;
  red_spice_stock: number;
  white_spice_stock: number;
  notes: string | null;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ActivityLog = {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_id: string | null;
  actor_name: string | null;
  details: Record<string, unknown>;
  created_at: string;
};
