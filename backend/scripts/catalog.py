"""Curated, category-consistent reference data for synthetic data generation.

This is intentionally hand-authored (not Faker.word() noise) per the project brief:
materials/suppliers must look like real mining-spares procurement data, even though the
transaction history built on top of them is synthetic. Real global brand names are
deliberately avoided for suppliers/manufacturers -- see generate_synthetic_data.py header.
"""

PLANTS = ["Gamsberg", "BMM"]

DEPARTMENTS = [
    "Mechanical Engineering",
    "Plant Maintenance",
    "Mining Operations",
    "Processing / Plant Operations",
    "Warehouse & Stores",
    "Procurement",
    "Instrumentation & Electrical",
    "Safety & SHEQ",
]

STORAGE_LOCATIONS_BY_PLANT = {
    "Gamsberg": ["GSB-MAIN-WH", "GSB-PLANT-STORE", "GSB-MINING-STORE"],
    "BMM": ["BMM-MAIN-WH", "BMM-PLANT-STORE", "BMM-WORKSHOP-STORE"],
}

# ---------------------------------------------------------------------------
# Materials: category -> list of base part templates.
# Each template: description stem (with {variant} placeholder), spec keys, uom,
# (min,max) unit price ZAR, criticality weights, whether it carries a service_code.
# ---------------------------------------------------------------------------

BEARING_SIZES = ["17mm", "20mm", "25mm", "30mm", "35mm", "40mm", "50mm", "60mm", "75mm", "90mm"]
VALVE_SIZES = ["25mm (1\")", "40mm (1.5\")", "50mm (2\")", "80mm (3\")", "100mm (4\")", "150mm (6\")", "200mm (8\")"]
MOTOR_RATINGS = ["7.5kW", "11kW", "15kW", "22kW", "30kW", "45kW", "55kW", "75kW", "90kW", "110kW"]
PUMP_DUTIES = ["Light duty", "Medium duty", "Heavy duty slurry", "High-head", "Low-flow metering"]
BELT_WIDTHS = ["650mm", "800mm", "1000mm", "1200mm", "1400mm", "1600mm"]

MATERIAL_TEMPLATES: dict[str, list[dict]] = {
    "Bearings": [
        {"stem": "Deep Groove Ball Bearing 62{variant_code}-2RS, {variant} bore", "uom": "EA", "price": (450, 3200), "criticality": "HIGH", "variants": BEARING_SIZES},
        {"stem": "Spherical Roller Bearing 222{variant_code}, {variant} bore", "uom": "EA", "price": (2800, 42000), "criticality": "HIGH", "variants": BEARING_SIZES},
        {"stem": "Tapered Roller Bearing 320{variant_code}, {variant} bore", "uom": "EA", "price": (900, 18500), "criticality": "MEDIUM", "variants": BEARING_SIZES},
        {"stem": "Pillow Block Bearing Unit UCP2{variant_code}, {variant} shaft", "uom": "EA", "price": (650, 9800), "criticality": "MEDIUM", "variants": BEARING_SIZES},
    ],
    "Pumps": [
        {"stem": "Centrifugal Slurry Pump Impeller, {variant}, hard metal", "uom": "EA", "price": (18000, 185000), "criticality": "CRITICAL", "variants": PUMP_DUTIES},
        {"stem": "Centrifugal Slurry Pump Casing Liner, {variant}", "uom": "EA", "price": (12000, 96000), "criticality": "HIGH", "variants": PUMP_DUTIES},
        {"stem": "Diaphragm Dosing Pump Head Assembly, {variant}", "uom": "EA", "price": (8500, 54000), "criticality": "MEDIUM", "variants": PUMP_DUTIES},
        {"stem": "Vertical Sump Pump Shaft Assembly, {variant}", "uom": "EA", "price": (22000, 140000), "criticality": "HIGH", "variants": PUMP_DUTIES},
    ],
    "Valves": [
        {"stem": "Knife Gate Valve, {variant}, rubber lined", "uom": "EA", "price": (3200, 68000), "criticality": "HIGH", "variants": VALVE_SIZES},
        {"stem": "Pinch Valve, {variant}, slurry service", "uom": "EA", "price": (4500, 78000), "criticality": "HIGH", "variants": VALVE_SIZES},
        {"stem": "Butterfly Valve, {variant}, wafer type", "uom": "EA", "price": (1800, 32000), "criticality": "MEDIUM", "variants": VALVE_SIZES},
        {"stem": "Ball Valve, {variant}, full bore, stainless trim", "uom": "EA", "price": (950, 21000), "criticality": "MEDIUM", "variants": VALVE_SIZES},
    ],
    "Motors": [
        {"stem": "TEFC Induction Motor, {variant}, 4-pole, IE3", "uom": "EA", "price": (14000, 165000), "criticality": "HIGH", "variants": MOTOR_RATINGS},
        {"stem": "Slip Ring Induction Motor, {variant}, 6-pole", "uom": "EA", "price": (38000, 320000), "criticality": "CRITICAL", "variants": MOTOR_RATINGS},
        {"stem": "Motor Drive Coupling, elastomeric, rated for {variant}", "uom": "EA", "price": (2200, 24000), "criticality": "MEDIUM", "variants": MOTOR_RATINGS},
    ],
    "Conveyor Components": [
        {"stem": "Conveyor Belt, steel cord, {variant} width", "uom": "M", "price": (850, 2400), "criticality": "HIGH", "variants": BELT_WIDTHS},
        {"stem": "Troughing Idler Set, {variant} belt width, 3-roll", "uom": "EA", "price": (1800, 6200), "criticality": "MEDIUM", "variants": BELT_WIDTHS},
        {"stem": "Impact Idler, {variant} belt width, rubber disc", "uom": "EA", "price": (1200, 4800), "criticality": "MEDIUM", "variants": BELT_WIDTHS},
        {"stem": "Belt Scraper Blade Set, {variant} width, tungsten tip", "uom": "SET", "price": (3400, 15600), "criticality": "MEDIUM", "variants": BELT_WIDTHS},
    ],
    "Crusher Components": [
        {"stem": "Jaw Crusher Fixed Jaw Plate, {variant}, manganese steel", "uom": "EA", "price": (28000, 165000), "criticality": "CRITICAL", "variants": ["standard", "high-manganese", "wave-profile", "corrugated"]},
        {"stem": "Cone Crusher Mantle, {variant} profile", "uom": "EA", "price": (85000, 420000), "criticality": "CRITICAL", "variants": ["standard", "fine", "coarse", "extra-coarse"]},
        {"stem": "Cone Crusher Concave Ring, {variant} profile", "uom": "EA", "price": (72000, 380000), "criticality": "CRITICAL", "variants": ["standard", "fine", "coarse", "extra-coarse"]},
        {"stem": "Crusher Toggle Plate, {variant} rating", "uom": "EA", "price": (18000, 62000), "criticality": "HIGH", "variants": ["standard", "heavy-duty"]},
    ],
    "Milling Components": [
        {"stem": "SAG Mill Liner Plate, {variant}, chrome-moly steel", "uom": "EA", "price": (32000, 145000), "criticality": "CRITICAL", "variants": ["shell", "head", "discharge grate", "lifter bar"]},
        {"stem": "Ball Mill Grinding Media, {variant}, forged steel balls", "uom": "TON", "price": (18500, 24500), "criticality": "HIGH", "variants": ["40mm", "60mm", "80mm", "100mm"]},
        {"stem": "Mill Trunnion Bearing Liner, {variant}", "uom": "EA", "price": (95000, 310000), "criticality": "CRITICAL", "variants": ["feed end", "discharge end"]},
    ],
    "Flotation Components": [
        {"stem": "Flotation Cell Impeller, {variant}, rubber coated", "uom": "EA", "price": (24000, 98000), "criticality": "HIGH", "variants": ["small cell", "medium cell", "large cell", "tank cell"]},
        {"stem": "Flotation Cell Stator, {variant}", "uom": "EA", "price": (22000, 92000), "criticality": "HIGH", "variants": ["small cell", "medium cell", "large cell", "tank cell"]},
        {"stem": "Froth Paddle Assembly, {variant}", "uom": "EA", "price": (8500, 32000), "criticality": "MEDIUM", "variants": ["small cell", "medium cell", "large cell", "tank cell"]},
    ],
    "Electrical Spares": [
        {"stem": "MCC Contactor, {variant}, 3-pole", "uom": "EA", "price": (1800, 22000), "criticality": "HIGH", "variants": ["18A", "32A", "65A", "95A", "150A", "225A"]},
        {"stem": "Variable Speed Drive, {variant}", "uom": "EA", "price": (28000, 285000), "criticality": "CRITICAL", "variants": MOTOR_RATINGS},
        {"stem": "Circuit Breaker, MCCB, {variant}", "uom": "EA", "price": (2400, 38000), "criticality": "HIGH", "variants": ["100A", "250A", "400A", "630A", "1000A"]},
        {"stem": "Power Cable, XLPE armoured, {variant}", "uom": "M", "price": (180, 950), "criticality": "MEDIUM", "variants": ["4-core 16mm2", "4-core 35mm2", "4-core 70mm2", "4-core 120mm2"]},
    ],
    "Instrumentation": [
        {"stem": "Pressure Transmitter, {variant} range, 4-20mA", "uom": "EA", "price": (6500, 32000), "criticality": "HIGH", "variants": ["0-10 bar", "0-25 bar", "0-40 bar", "0-100 bar"]},
        {"stem": "Level Transmitter, ultrasonic, {variant} range", "uom": "EA", "price": (8500, 38000), "criticality": "HIGH", "variants": ["0-5m", "0-10m", "0-15m", "0-20m"]},
        {"stem": "Flow Meter, magnetic, {variant}", "uom": "EA", "price": (18000, 145000), "criticality": "HIGH", "variants": VALVE_SIZES},
        {"stem": "Density Meter, nuclear, {variant} pipe", "uom": "EA", "price": (65000, 220000), "criticality": "CRITICAL", "variants": VALVE_SIZES},
    ],
    "Mechanical Seals": [
        {"stem": "Mechanical Seal, {variant}, tungsten carbide faces", "uom": "EA", "price": (4200, 68000), "criticality": "HIGH", "variants": ["shaft 25mm", "shaft 38mm", "shaft 50mm", "shaft 65mm", "shaft 80mm", "shaft 100mm"]},
        {"stem": "Gland Packing Set, {variant}, PTFE impregnated", "uom": "SET", "price": (850, 6200), "criticality": "MEDIUM", "variants": ["shaft 25mm", "shaft 38mm", "shaft 50mm", "shaft 65mm", "shaft 80mm", "shaft 100mm"]},
        {"stem": "Seal Support System, API Plan 32, {variant}", "uom": "EA", "price": (28000, 92000), "criticality": "HIGH", "variants": ["shaft 25mm", "shaft 38mm", "shaft 50mm", "shaft 65mm", "shaft 80mm", "shaft 100mm"]},
    ],
}

SERVICE_CATEGORIES = ["Repair", "Inspection", "Calibration", "Installation", "Refurbishment"]
SERVICE_CODE_POOL = [f"SVC-{c[:3].upper()}-{i:02d}" for c in SERVICE_CATEGORIES for i in range(1, 4)]

# ---------------------------------------------------------------------------
# Suppliers -- deliberately fictional names (region/mining terms + generic supply-business
# words), never real distributor/OEM brand names, since this is fabricated transaction/rating
# history. Country pool leans South Africa with a handful of regional/overseas suppliers,
# matching the original prototype's "SA + international" supplier mix.
# ---------------------------------------------------------------------------

SUPPLIER_NAME_PREFIXES = [
    "Karoo", "Kalahari", "Highveld", "Bushveld", "Escarpment", "Namaqua", "Drakensberg",
    "Vaal", "Waterberg", "Lowveld", "Northern Cape", "Sutherland", "Kimberley", "Orange River",
    "Copperton", "Springbok", "Aggeneys", "Postmasburg", "Kuruman", "Upington",
]
SUPPLIER_NAME_SUFFIXES = [
    "Industrial Supplies", "Bearing & Drive Co", "Pump Solutions", "Valve & Fittings",
    "Electromechanical Ltd", "Mining Equipment Traders", "Seals & Sealing Systems",
    "Engineering Supplies", "Industrial Distributors", "Spares & Components",
]
SUPPLIER_CATEGORIES = [
    "Bearings & Power Transmission", "Pumps & Fluid Handling", "Valves & Piping",
    "Electrical & Instrumentation", "Mechanical Seals", "Crusher & Mill Wear Parts",
    "Conveyor Equipment", "General Mining Consumables",
]
SUPPLIER_COUNTRIES = ["South Africa", "South Africa", "South Africa", "South Africa", "Namibia", "Zambia", "Germany", "China"]

MANUFACTURER_NAME_PREFIXES = [
    "Karoo", "Vaal", "Escarpment", "Highveld", "Namaqua", "Bushveld", "Sutherland", "Copperton",
]
MANUFACTURER_NAME_SUFFIXES = [
    "Bearing Works", "Pump Manufacturing", "Seal Technologies", "Valve Foundry",
    "Electromechanical Works", "Wear Parts Casting", "Precision Engineering",
]

# ---------------------------------------------------------------------------
# Pipeline stage definitions -- data, not hardcoded business logic (see ProcessStageDefinition).
# ---------------------------------------------------------------------------

STAGE_DEFINITIONS = [
    ("RR_CREATED", "RR Created", 1, "Requesting Department"),
    ("DOA", "DOA Approval", 2, "Engineering / Commercial Management"),
    ("MRP", "MRP Processing", 3, "Procurement"),
    ("PR_CREATED", "PR Created", 4, "Procurement"),
    ("RFQ", "RFQ", 5, "Procurement"),
    ("ARIBA", "Ariba Event", 6, "Procurement"),
    ("AUCTION", "Auction", 7, "Procurement"),
    ("NFA", "NFA Approval", 8, "Commercial Management"),
    ("PO_CREATED", "PO Created", 9, "Procurement"),
]
