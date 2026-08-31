import { loadCsv, bool, num, strOrNull } from "./csv";
import type {
  MaterialRow,
  SupplierRow,
  PORow,
  POLineItemRow,
  EquipmentRow,
  ConsumptionRow,
  GoodsReceiptRow,
  CurrentInventoryRow,
  CriticalityPolicyRow,
  MaintenanceOrderRow,
  EquipmentUtilizationRow,
  UserRow,
  SpareData,
} from "./types";

const DATA_DIR = "/data";

function loadMaterials() {
  return loadCsv<MaterialRow>(`${DATA_DIR}/materials.csv`, (r) => ({
    id: r.id,
    material_code: r.material_code,
    description: r.description,
    material_group: r.material_group,
    material_type: r.material_type,
    plant: r.plant,
    storage_location: r.storage_location,
    unit_of_measure: r.unit_of_measure,
    criticality: r.criticality as MaterialRow["criticality"],
    lifecycle_status: r.lifecycle_status,
    service_code: strOrNull(r.service_code),
    manufacturer: strOrNull(r.manufacturer),
    manufacturer_part_no: strOrNull(r.manufacturer_part_no),
    last_po_price: num(r.last_po_price),
    last_vendor: strOrNull(r.last_vendor),
    stock_level: num(r.stock_level),
    lead_time_days: num(r.lead_time_days),
    active: bool(r.active),
    created_at: r.created_at,
    updated_at: r.updated_at,
    equipment_id: r.equipment_id,
    equipment_type: r.equipment_type,
    circuit: r.circuit as MaterialRow["circuit"],
    current_rop: num(r.current_rop),
    current_safety_stock: num(r.current_safety_stock),
    current_max_stock: num(r.current_max_stock),
    oar_flag: bool(r.oar_flag),
    service_level_target_pct: strOrNull(r.service_level_target_pct),
  }));
}

function loadSuppliers() {
  return loadCsv<SupplierRow>(`${DATA_DIR}/suppliers.csv`, (r) => ({
    id: r.id,
    supplier_code: r.supplier_code,
    supplier_name: r.supplier_name,
    country: r.country,
    category: r.category,
    rating: num(r.rating),
    active: bool(r.active),
  }));
}

function loadPO() {
  return loadCsv<PORow>(`${DATA_DIR}/po.csv`, (r) => ({
    id: r.id,
    po_number: r.po_number,
    pr_id: r.pr_id,
    supplier_id: r.supplier_id,
    creation_date: r.creation_date,
    expected_delivery: r.expected_delivery,
    status: r.status,
    total_value: num(r.total_value),
    buyer_id: r.buyer_id,
  }));
}

function loadPOLineItems() {
  return loadCsv<POLineItemRow>(`${DATA_DIR}/po_line_items.csv`, (r) => ({
    id: r.id,
    po_id: r.po_id,
    material_id: r.material_id,
    quantity: num(r.quantity),
    unit_price: num(r.unit_price),
    line_total: num(r.line_total),
    delivery_date: r.delivery_date,
    status: r.status,
  }));
}

function loadEquipment() {
  return loadCsv<EquipmentRow>(`${DATA_DIR}/equipment.csv`, (r) => ({
    equipment_id: r.equipment_id,
    equipment_type: r.equipment_type,
    circuit: r.circuit as EquipmentRow["circuit"],
    plant: r.plant,
  }));
}

function loadConsumptionHistory() {
  return loadCsv<ConsumptionRow>(`${DATA_DIR}/consumption_history.csv`, (r) => ({
    material_id: r.material_id,
    period_month: r.period_month,
    qty_consumed: num(r.qty_consumed),
    movement_type: r.movement_type,
    plant: r.plant,
  }));
}

function loadGoodsReceipt() {
  return loadCsv<GoodsReceiptRow>(`${DATA_DIR}/goods_receipt.csv`, (r) => ({
    po_number: r.po_number,
    material_id: r.material_id,
    vendor: r.vendor,
    po_creation_date: r.po_creation_date,
    expected_delivery_date: r.expected_delivery_date,
    goods_receipt_date: r.goods_receipt_date,
    ordered_qty: num(r.ordered_qty),
    received_qty: num(r.received_qty),
    po_status: r.po_status,
  }));
}

function loadCurrentInventory() {
  return loadCsv<CurrentInventoryRow>(`${DATA_DIR}/current_inventory.csv`, (r) => ({
    material_id: r.material_id,
    plant: r.plant,
    unrestricted_stock: num(r.unrestricted_stock),
    blocked_stock: num(r.blocked_stock),
    reserved_stock: num(r.reserved_stock),
    open_po_qty: num(r.open_po_qty),
  }));
}

function loadCriticalityPolicy() {
  return loadCsv<CriticalityPolicyRow>(`${DATA_DIR}/criticality_policy.csv`, (r) => ({
    criticality: r.criticality as CriticalityPolicyRow["criticality"],
    circuit: r.circuit as CriticalityPolicyRow["circuit"],
    service_level_target_pct: strOrNull(r.service_level_target_pct),
    z_factor: strOrNull(r.z_factor),
    status: r.status,
  }));
}

function loadMaintenanceOrders() {
  return loadCsv<MaintenanceOrderRow>(`${DATA_DIR}/maintenance_orders.csv`, (r) => ({
    work_order: r.work_order,
    material_id: r.material_id,
    equipment_id: r.equipment_id,
    planned_date: r.planned_date,
    required_qty: num(r.required_qty),
    maintenance_type: r.maintenance_type,
  }));
}

function loadEquipmentUtilization() {
  return loadCsv<EquipmentUtilizationRow>(`${DATA_DIR}/equipment_utilization.csv`, (r) => ({
    equipment_id: r.equipment_id,
    period_month: r.period_month,
    operating_hours: num(r.operating_hours),
    utilization_pct: num(r.utilization_pct),
  }));
}

function loadUsers() {
  return loadCsv<UserRow>(`${DATA_DIR}/users.csv`, (r) => ({
    id: r.id,
    employee_code: r.employee_code,
    name: r.name,
    email: r.email,
    department: r.department,
    role: r.role,
    plant: r.plant,
    active: bool(r.active),
  }));
}

export async function loadAllSpareData(): Promise<SpareData> {
  const [
    materials,
    suppliers,
    po,
    poLineItems,
    equipment,
    consumptionHistory,
    goodsReceipt,
    currentInventory,
    criticalityPolicy,
    maintenanceOrders,
    equipmentUtilization,
    users,
  ] = await Promise.all([
    loadMaterials(),
    loadSuppliers(),
    loadPO(),
    loadPOLineItems(),
    loadEquipment(),
    loadConsumptionHistory(),
    loadGoodsReceipt(),
    loadCurrentInventory(),
    loadCriticalityPolicy(),
    loadMaintenanceOrders(),
    loadEquipmentUtilization(),
    loadUsers(),
  ]);

  return {
    materials,
    suppliers,
    po,
    poLineItems,
    equipment,
    consumptionHistory,
    goodsReceipt,
    currentInventory,
    criticalityPolicy,
    maintenanceOrders,
    equipmentUtilization,
    users,
  };
}
