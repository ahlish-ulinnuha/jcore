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
  latitude: number | null;
  longitude: number | null;
  geofence_radius_m: number;
};

export type Vendor = {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  is_active: boolean;
  auto_send_purchase: boolean;
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
  products?: Product | null;
  vendors?: Vendor | null;
};

export type ProductVendorAlias = {
  id: string;
  product_id: string;
  vendor_id: string;
  alias_name: string;
  normalized_alias_name: string;
  confidence: number;
  is_active: boolean;
  notes: string | null;
  last_used_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  products?: Product | null;
  vendors?: Vendor | null;
};

export type ProductVendorPrice = {
  id: string;
  product_id: string;
  vendor_id: string;
  current_price: number;
  last_source: string | null;
  last_source_id: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  products?: Product | null;
  vendors?: Vendor | null;
};

export type ProductPriceHistory = {
  id: string;
  product_id: string;
  vendor_id: string;
  old_price: number | null;
  new_price: number;
  price_diff: number;
  price_diff_percent: number | null;
  source: string | null;
  source_id: string | null;
  changed_by: string | null;
  changed_at: string;
  products?: Product | null;
  vendors?: Vendor | null;
};

export type ShiftType = {
  code: string;
  name: string;
  start_time: string;
  end_time: string;
  sort_order: number;
  is_active: boolean;
};

export type StoreScheduleMonth = {
  id: string;
  store_id: string;
  schedule_month: string;
  status: "draft" | "pending_approval" | "approved";
  submitted_by: string | null;
  submitted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type StoreStaffSchedule = {
  id: string;
  schedule_month_id: string;
  store_id: string;
  staff_id: string;
  work_date: string;
  shift_code: string | null;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type StaffAttendance = {
  id: string;
  staff_id: string;
  store_id: string;
  check_in_at: string;
  check_in_latitude: number;
  check_in_longitude: number;
  check_in_accuracy: number | null;
  check_in_distance_m: number | null;
  check_out_at: string | null;
  check_out_latitude: number | null;
  check_out_longitude: number | null;
  check_out_accuracy: number | null;
  check_out_distance_m: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ProfileMenuAccess = {
  id: string;
  profile_id: string;
  menu_key: string;
  can_access: boolean;
  created_at: string;
  updated_at: string;
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
  purchased_qty: number | null;
  purchase_price: number | null;
  unit: string;
  status: "requested" | "confirmed" | "unavailable" | "partially_available" | "fulfilled" | "cancelled";
  vendor_note: string | null;
  receipt_url: string | null;
  products?: Product | null;
  vendors?: Vendor | null;
  purchase_requests?: PurchaseRequest | null;
};

export type VendorReceipt = {
  id: string;
  vendor_id: string;
  request_id: string | null;
  store_id: string | null;
  batch_no: number | null;
  request_date: string;
  receipt_url: string;
  file_name: string | null;
  notes: string | null;
  uploaded_by: string | null;
  created_at: string;
  vendors?: Vendor | null;
};

export type VendorMessageLog = {
  id: string;
  vendor_id: string;
  request_date: string;
  batch_no: number;
  channel: string;
  message: string;
  phone: string | null;
  source: "manual" | "cron";
  status: "success" | "failed";
  error_message: string | null;
  sent_by: string | null;
  created_at: string;
  vendors?: Vendor | null;
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

export type DailySalesReport = {
  id: string;
  report_date: string;
  store_id: string;
  store_name: string;
  system_nominal: number;
  cash_total: number;
  cash_100000: number;
  cash_50000: number;
  cash_20000: number;
  cash_10000: number;
  cash_5000: number;
  cash_2000: number;
  cash_1000: number;
  cash_500: number;
  cash_200: number;
  cash_100: number;
  qris: number;
  debit: number;
  shopee: number;
  grab: number;
  gojek: number;
  expense: number;
  expense_detail: string | null;
  difference: number;
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
