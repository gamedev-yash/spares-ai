// Row shapes exactly as they appear in the CSVs under /public/data/, after minimal type
// coercion (numbers/booleans parsed, everything else stays a string). Column names below
// are copy-pasted from the actual CSV headers -- see backend/data/*.csv in the spares-ai
// repo this data was generated from.
//
// IMPORTANT schema note verified against the real files (not assumed from the spec): the
// join key used everywhere as `material_id` is materials.csv's plain numeric `id` column
// (e.g. "1", "2", ... "220"), NOT `material_code` (which is the "500-10001"-style business
// code, display-only, never used as a foreign key by any of the Initiative-7 tables).

export type Criticality = "CRITICAL" | "HIGH" | "MEDIUM";
export type Circuit = "Crushing" | "Milling" | "Pumping" | "Filtration";

export interface MaterialRow {
  id: string;
  material_code: string;
  description: string;
  material_group: string;
  material_type: string;
  plant: string;
  storage_location: string;
  unit_of_measure: string;
  criticality: Criticality;
  lifecycle_status: string;
  service_code: string | null;
  manufacturer: string | null;
  manufacturer_part_no: string | null;
  last_po_price: number;
  last_vendor: string | null;
  stock_level: number;
  lead_time_days: number;
  active: boolean;
  created_at: string;
  updated_at: string;
  // Initiative-7 columns, appended to the original schema:
  equipment_id: string;
  equipment_type: string;
  circuit: Circuit;
  current_rop: number;
  current_safety_stock: number;
  current_max_stock: number;
  oar_flag: boolean;
  service_level_target_pct: string | null; // always blank in this dataset -- pending sign-off
}

export interface SupplierRow {
  id: string;
  supplier_code: string;
  supplier_name: string;
  country: string;
  category: string;
  rating: number;
  active: boolean;
}

export interface PORow {
  id: string;
  po_number: string;
  pr_id: string;
  supplier_id: string;
  creation_date: string;
  expected_delivery: string;
  status: string;
  total_value: number;
  buyer_id: string;
}

export interface POLineItemRow {
  id: string;
  po_id: string;
  material_id: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  delivery_date: string;
  status: string;
}

export interface EquipmentRow {
  equipment_id: string;
  equipment_type: string;
  circuit: Circuit;
  plant: string;
}

export interface ConsumptionRow {
  material_id: string;
  period_month: string; // "YYYY-MM"
  qty_consumed: number;
  movement_type: string;
  plant: string;
}

export interface GoodsReceiptRow {
  po_number: string;
  material_id: string;
  vendor: string;
  po_creation_date: string; // "YYYY-MM-DD"
  expected_delivery_date: string;
  goods_receipt_date: string;
  ordered_qty: number;
  received_qty: number;
  po_status: string;
}

export interface CurrentInventoryRow {
  material_id: string;
  plant: string;
  unrestricted_stock: number;
  blocked_stock: number;
  reserved_stock: number;
  open_po_qty: number;
}

export interface CriticalityPolicyRow {
  criticality: Criticality;
  circuit: Circuit;
  service_level_target_pct: string | null; // blank -- pending sign-off
  z_factor: string | null; // blank -- pending sign-off
  status: string; // "PENDING_SIGNOFF" for every row in this dataset
}

export interface MaintenanceOrderRow {
  work_order: string;
  material_id: string;
  equipment_id: string;
  planned_date: string;
  required_qty: number;
  maintenance_type: string;
}

export interface EquipmentUtilizationRow {
  equipment_id: string;
  period_month: string;
  operating_hours: number;
  utilization_pct: number;
}

export interface SpareData {
  materials: MaterialRow[];
  suppliers: SupplierRow[];
  po: PORow[];
  poLineItems: POLineItemRow[];
  equipment: EquipmentRow[];
  consumptionHistory: ConsumptionRow[];
  goodsReceipt: GoodsReceiptRow[];
  currentInventory: CurrentInventoryRow[];
  criticalityPolicy: CriticalityPolicyRow[];
  maintenanceOrders: MaintenanceOrderRow[];
  equipmentUtilization: EquipmentUtilizationRow[];
  users: UserRow[];
}

export interface UserRow {
  id: string;
  employee_code: string;
  name: string;
  email: string;
  department: string;
  role: string;
  plant: string;
  active: boolean;
}
