import type {
  AlternateRecommendation,
  AuditEntry,
  CategoryBreakdownPoint,
  ChatSession,
  DashboardSummary,
  Material,
  PendingApproval,
  SavingsTrendPoint,
  Supplier,
} from "@/lib/types"
import { NEW_SESSION_ID } from "@/lib/constants"
import { formatZAR } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Suppliers
// ---------------------------------------------------------------------------

export const SUPPLIERS: Supplier[] = [
  {
    id: "sup-bearings-intl",
    name: "Bearings International (Pty) Ltd",
    region: "Gauteng, South Africa",
    categoriesServed: ["Milling", "Conveyance"],
    rating: 4.6,
    onTimeDeliveryPct: 94,
    avgLeadTimeDays: 5,
    certifications: ["ISO 9001", "ISO 14001", "BBBEE Level 2"],
  },
  {
    id: "sup-bmg",
    name: "BMG (Bearing Man Group)",
    region: "KwaZulu-Natal, South Africa",
    categoriesServed: ["Conveyance", "Milling"],
    rating: 4.4,
    onTimeDeliveryPct: 91,
    avgLeadTimeDays: 6,
    certifications: ["ISO 9001", "BBBEE Level 4"],
  },
  {
    id: "sup-becker",
    name: "Becker Mining South Africa",
    region: "Gauteng, South Africa",
    categoriesServed: ["Instrumentation", "Milling"],
    rating: 4.3,
    onTimeDeliveryPct: 89,
    avgLeadTimeDays: 9,
    certifications: ["ISO 9001", "ISO 14001"],
  },
  {
    id: "sup-hytec",
    name: "Hytec Group",
    region: "Gauteng, South Africa",
    categoriesServed: ["Flotation", "Conveyance"],
    rating: 4.1,
    onTimeDeliveryPct: 87,
    avgLeadTimeDays: 10,
    certifications: ["ISO 9001", "BBBEE Level 2"],
  },
  {
    id: "sup-sew",
    name: "SEW-Eurodrive SA",
    region: "Western Cape, South Africa",
    categoriesServed: ["Milling", "Conveyance"],
    rating: 4.7,
    onTimeDeliveryPct: 96,
    avgLeadTimeDays: 7,
    certifications: ["ISO 9001", "ISO 14001", "BBBEE Level 1"],
  },
  {
    id: "sup-zestweg",
    name: "Zest WEG Group",
    region: "Gauteng, South Africa",
    categoriesServed: ["Milling", "Flotation"],
    rating: 4.5,
    onTimeDeliveryPct: 93,
    avgLeadTimeDays: 8,
    certifications: ["ISO 9001", "ISO 14001", "BBBEE Level 2"],
  },
  {
    id: "sup-invicta",
    name: "Invicta Holdings",
    region: "Gauteng, South Africa",
    categoriesServed: ["Conveyance", "Instrumentation"],
    rating: 4.2,
    onTimeDeliveryPct: 88,
    avgLeadTimeDays: 9,
    certifications: ["ISO 9001", "BBBEE Level 3"],
  },
  {
    id: "sup-motioncontrol",
    name: "Motion Control Systems",
    region: "Gauteng, South Africa",
    categoriesServed: ["Instrumentation", "Milling"],
    rating: 4.0,
    onTimeDeliveryPct: 85,
    avgLeadTimeDays: 11,
    certifications: ["ISO 9001"],
  },
  {
    id: "sup-flowserveza",
    name: "FlowserveZA",
    region: "Gauteng, South Africa",
    categoriesServed: ["Milling", "Flotation"],
    rating: 4.6,
    onTimeDeliveryPct: 92,
    avgLeadTimeDays: 14,
    certifications: ["ISO 9001", "ISO 14001", "BBBEE Level 2"],
  },
  {
    id: "sup-weir",
    name: "Weir Minerals Africa",
    region: "Gauteng, South Africa",
    categoriesServed: ["Milling", "Flotation", "Conveyance"],
    rating: 4.8,
    onTimeDeliveryPct: 97,
    avgLeadTimeDays: 12,
    certifications: ["ISO 9001", "ISO 14001", "BBBEE Level 1"],
  },
  {
    id: "sup-johncrane",
    name: "John Crane Southern Africa",
    region: "Gauteng, South Africa",
    categoriesServed: ["Milling"],
    rating: 4.5,
    onTimeDeliveryPct: 90,
    avgLeadTimeDays: 15,
    certifications: ["ISO 9001", "ISO 14001"],
  },
  {
    id: "sup-eagleburgmann",
    name: "EagleBurgmann Africa",
    region: "Gauteng, South Africa",
    categoriesServed: ["Milling", "Flotation"],
    rating: 4.4,
    onTimeDeliveryPct: 89,
    avgLeadTimeDays: 16,
    certifications: ["ISO 9001"],
  },
]

export function getSupplierById(id: string): Supplier | undefined {
  return SUPPLIERS.find((s) => s.id === id)
}

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------

export const MATERIALS: Material[] = [
  // Mechanical seals — Milling
  {
    id: "500-14892",
    description: "Seal Assy, Mech Type XR-200",
    manufacturer: "Flowserve",
    manufacturerPartNo: "XR-200-65-VV",
    specs: {
      "Shaft size": "65mm",
      "Seal face": "SiC/SiC",
      Elastomer: "Viton",
      "Pressure rating": "12 bar",
    },
    category: "Milling",
    lifecycleStatus: "Active",
    lastPoPrice: 48200,
    lastPoDate: "14 Mar 2026",
    lastVendor: "Flowserve SA",
    stockLevel: 2,
    leadTimeDays: 21,
  },
  {
    id: "500-14905",
    description: "Seal Assy, Mech Type XR-150",
    manufacturer: "Flowserve",
    manufacturerPartNo: "XR-150-50-VV",
    specs: {
      "Shaft size": "50mm",
      "Seal face": "SiC/SiC",
      Elastomer: "Viton",
      "Pressure rating": "10 bar",
    },
    category: "Milling",
    lifecycleStatus: "Active",
    lastPoPrice: 31400,
    lastPoDate: "2 Feb 2026",
    lastVendor: "Flowserve SA",
    stockLevel: 1,
    leadTimeDays: 21,
  },
  {
    id: "500-15020",
    description: "Cartridge Seal, Type 5610",
    manufacturer: "John Crane",
    manufacturerPartNo: "5610-70-CC",
    specs: {
      "Shaft size": "70mm",
      "Seal face": "Carbon/SiC",
      Elastomer: "EPDM",
      "Pressure rating": "16 bar",
    },
    category: "Milling",
    lifecycleStatus: "Active",
    lastPoPrice: 52600,
    lastPoDate: "28 Jan 2026",
    lastVendor: "John Crane Southern Africa",
    stockLevel: 1,
    leadTimeDays: 28,
  },
  {
    id: "500-15134",
    description: "Split Seal, Type DiaSplit",
    manufacturer: "EagleBurgmann",
    manufacturerPartNo: "DS-80-VIT",
    specs: {
      "Shaft size": "80mm",
      "Seal face": "SiC/SiC",
      Elastomer: "Viton",
      "Pressure rating": "14 bar",
    },
    category: "Milling",
    lifecycleStatus: "Active",
    lastPoPrice: 61300,
    lastPoDate: "9 Dec 2025",
    lastVendor: "EagleBurgmann Africa",
    stockLevel: 0,
    leadTimeDays: 35,
  },

  // Slurry pump impellers — Flotation
  {
    id: "500-08823",
    description: "Impeller, Slurry Pump, AH 6/4",
    manufacturer: "Warman",
    manufacturerPartNo: "AH-6-4-IMP-HC",
    specs: {
      Material: "High-chrome iron",
      "Vane config": "5-vane closed",
      Bore: "60mm",
      Duty: "Heavy slurry",
    },
    category: "Flotation",
    lifecycleStatus: "Active",
    lastPoPrice: 74500,
    lastPoDate: "18 Mar 2026",
    lastVendor: "Weir Minerals Africa",
    stockLevel: 1,
    leadTimeDays: 30,
  },
  {
    id: "500-08841",
    description: "Impeller, Slurry Pump, MDM 100",
    manufacturer: "Metso",
    manufacturerPartNo: "MDM100-IMP",
    specs: {
      Material: "High-chrome iron",
      "Vane config": "4-vane open",
      Bore: "55mm",
      Duty: "Medium slurry",
    },
    category: "Flotation",
    lifecycleStatus: "Active",
    lastPoPrice: 58200,
    lastPoDate: "22 Nov 2025",
    lastVendor: "Zest WEG Group",
    stockLevel: 2,
    leadTimeDays: 24,
  },
  {
    id: "500-08876",
    description: "Impeller, Froth Pump, GIW LSA",
    manufacturer: "KSB",
    manufacturerPartNo: "GIW-LSA-IMP",
    specs: {
      Material: "Elastomer-lined",
      "Vane config": "3-vane",
      Bore: "65mm",
      Duty: "Froth / abrasive",
    },
    category: "Flotation",
    lifecycleStatus: "Active",
    lastPoPrice: 66900,
    lastPoDate: "5 Jan 2026",
    lastVendor: "Hytec Group",
    stockLevel: 0,
    leadTimeDays: 32,
  },
  {
    id: "500-08902",
    description: "Impeller, Slurry Pump, AH 4/3",
    manufacturer: "Warman",
    manufacturerPartNo: "AH-4-3-IMP-HC",
    specs: {
      Material: "High-chrome iron",
      "Vane config": "5-vane closed",
      Bore: "45mm",
      Duty: "Heavy slurry",
    },
    category: "Flotation",
    lifecycleStatus: "Active",
    lastPoPrice: 41800,
    lastPoDate: "14 Feb 2026",
    lastVendor: "Weir Minerals Africa",
    stockLevel: 3,
    leadTimeDays: 21,
  },

  // Conveyor belts, rollers, bearings — Conveyance
  {
    id: "500-22140",
    description: "Bearing, Spherical Roller, Conveyor Idler",
    manufacturer: "SKF",
    manufacturerPartNo: "SKF-22312-CC",
    specs: {
      Bore: "60mm",
      "Seal type": "Labyrinth",
      "Load rating": "95kN",
      Duty: "Troughing idler",
    },
    category: "Conveyance",
    lifecycleStatus: "Active",
    lastPoPrice: 8400,
    lastPoDate: "11 Mar 2026",
    lastVendor: "BMG (Bearing Man Group)",
    stockLevel: 6,
    leadTimeDays: 7,
  },
  {
    id: "500-22188",
    description: "Conveyor Belt, ST1000 Steel Cord",
    manufacturer: "Continental",
    manufacturerPartNo: "CT-ST1000-1200",
    specs: {
      Width: "1200mm",
      Carcass: "Steel cord",
      "Cover grade": "DIN Y",
      Length: "180m",
    },
    category: "Conveyance",
    lifecycleStatus: "Active",
    lastPoPrice: 186500,
    lastPoDate: "30 Oct 2025",
    lastVendor: "Invicta Holdings",
    stockLevel: 1,
    leadTimeDays: 45,
  },
  {
    id: "500-22219",
    description: "Conveyor Belt, EP400/3 Fabric",
    manufacturer: "Fenner",
    manufacturerPartNo: "FN-EP400-1050",
    specs: {
      Width: "1050mm",
      Carcass: "EP fabric 3-ply",
      "Cover grade": "DIN X",
      Length: "120m",
    },
    category: "Conveyance",
    lifecycleStatus: "Active",
    lastPoPrice: 94200,
    lastPoDate: "19 Jan 2026",
    lastVendor: "Invicta Holdings",
    stockLevel: 0,
    leadTimeDays: 38,
  },
  {
    id: "500-22254",
    description: "Troughing Roller Set, 35°",
    manufacturer: "Dunlop",
    manufacturerPartNo: "DL-TR35-127",
    specs: {
      Diameter: "127mm",
      "Trough angle": "35°",
      Shaft: "20mm hex",
      Duty: "Medium",
    },
    category: "Conveyance",
    lifecycleStatus: "Active",
    lastPoPrice: 4200,
    lastPoDate: "24 Feb 2026",
    lastVendor: "Invicta Holdings",
    stockLevel: 12,
    leadTimeDays: 5,
  },
  {
    id: "500-22301",
    description: "Bearing, Spherical Roller, Head Pulley",
    manufacturer: "SKF",
    manufacturerPartNo: "SKF-22320-CC",
    specs: {
      Bore: "100mm",
      "Seal type": "Labyrinth",
      "Load rating": "156kN",
      Duty: "Head pulley",
    },
    category: "Conveyance",
    lifecycleStatus: "Active",
    lastPoPrice: 14600,
    lastPoDate: "3 Mar 2026",
    lastVendor: "BMG (Bearing Man Group)",
    stockLevel: 3,
    leadTimeDays: 9,
  },

  // Pressure / level transmitters — Instrumentation
  {
    id: "500-31005",
    description: "Pressure Transmitter, Cerabar PMC21",
    manufacturer: "Endress+Hauser",
    manufacturerPartNo: "PMC21-A1F1H",
    specs: {
      Range: "0–16 bar",
      Output: "4-20mA HART",
      "Process conn": "G1/2",
      Accuracy: "0.15%",
    },
    category: "Instrumentation",
    lifecycleStatus: "Active",
    lastPoPrice: 18900,
    lastPoDate: "27 Feb 2026",
    lastVendor: "Becker Mining South Africa",
    stockLevel: 2,
    leadTimeDays: 14,
  },
  {
    id: "500-31048",
    description: "Pressure Transmitter, EJA430E",
    manufacturer: "Yokogawa",
    manufacturerPartNo: "EJA430E-EAS4",
    specs: {
      Range: "0–10 bar",
      Output: "4-20mA HART",
      "Process conn": "1/2 NPT",
      Accuracy: "0.1%",
    },
    category: "Instrumentation",
    lifecycleStatus: "Active",
    lastPoPrice: 21400,
    lastPoDate: "15 Dec 2025",
    lastVendor: "Motion Control Systems",
    stockLevel: 1,
    leadTimeDays: 18,
  },
  {
    id: "500-31090",
    description: "Pressure Transmitter, 2600T",
    manufacturer: "ABB",
    manufacturerPartNo: "266HSH",
    specs: {
      Range: "0–25 bar",
      Output: "4-20mA HART",
      "Process conn": "G1/2",
      Accuracy: "0.1%",
    },
    category: "Instrumentation",
    lifecycleStatus: "EOL",
    lastPoPrice: 19600,
    lastPoDate: "8 Sep 2025",
    lastVendor: "Motion Control Systems",
    stockLevel: 0,
    leadTimeDays: 21,
  },
  {
    id: "500-31122",
    description: "Level Transmitter, Radar FMR10",
    manufacturer: "Endress+Hauser",
    manufacturerPartNo: "FMR10-A",
    specs: {
      Range: "0–8m",
      Output: "4-20mA",
      "Process conn": "Thread G3/4",
      Frequency: "80GHz",
    },
    category: "Instrumentation",
    lifecycleStatus: "Active",
    lastPoPrice: 15200,
    lastPoDate: "20 Jan 2026",
    lastVendor: "Becker Mining South Africa",
    stockLevel: 3,
    leadTimeDays: 12,
  },

  // Mill bearings — Milling
  {
    id: "500-40011",
    description: "Bearing, Spherical Roller, Mill Trunnion",
    manufacturer: "Timken",
    manufacturerPartNo: "24176-EJA",
    specs: {
      Bore: "380mm",
      "Seal type": "Taconite",
      "Load rating": "1250kN",
      Duty: "Mill trunnion",
    },
    category: "Milling",
    lifecycleStatus: "Active",
    lastPoPrice: 142000,
    lastPoDate: "12 Feb 2026",
    lastVendor: "SEW-Eurodrive SA",
    stockLevel: 1,
    leadTimeDays: 40,
  },
  {
    id: "500-40056",
    description: "Bearing, Deep Groove Ball, Motor DE",
    manufacturer: "NSK",
    manufacturerPartNo: "6316-2RS",
    specs: {
      Bore: "80mm",
      "Seal type": "2RS",
      "Load rating": "40kN",
      Duty: "Motor drive-end",
    },
    category: "Milling",
    lifecycleStatus: "Active",
    lastPoPrice: 3900,
    lastPoDate: "4 Mar 2026",
    lastVendor: "Zest WEG Group",
    stockLevel: 8,
    leadTimeDays: 6,
  },
  {
    id: "500-40098",
    description: "Bearing, Cylindrical Roller, Gearbox",
    manufacturer: "FAG",
    manufacturerPartNo: "NU 2216 ECP",
    specs: {
      Bore: "80mm",
      "Seal type": "Open",
      "Load rating": "85kN",
      Duty: "Gearbox input shaft",
    },
    category: "Milling",
    lifecycleStatus: "Active",
    lastPoPrice: 9800,
    lastPoDate: "17 Nov 2025",
    lastVendor: "SEW-Eurodrive SA",
    stockLevel: 2,
    leadTimeDays: 15,
  },

  // Valves — Milling
  {
    id: "500-19560",
    description: "Control Valve, Globe, easy-E",
    manufacturer: "Fisher",
    manufacturerPartNo: "ED-3-EWT",
    specs: {
      Size: "3in",
      Trim: "Equal %",
      Actuator: "667 spring-diaphragm",
      Body: "WCC",
    },
    category: "Milling",
    lifecycleStatus: "Active",
    lastPoPrice: 89400,
    lastPoDate: "10 Jan 2026",
    lastVendor: "Motion Control Systems",
    stockLevel: 0,
    leadTimeDays: 28,
  },
  {
    id: "500-19602",
    description: "Control Valve, Rotary, Neldisc",
    manufacturer: "Neles",
    manufacturerPartNo: "R21-6IN",
    specs: {
      Size: "6in",
      Trim: "Metal seated",
      Actuator: "Pneumatic quarter-turn",
      Body: "WCB",
    },
    category: "Milling",
    lifecycleStatus: "Active",
    lastPoPrice: 112500,
    lastPoDate: "26 Sep 2025",
    lastVendor: "Hytec Group",
    stockLevel: 1,
    leadTimeDays: 33,
  },
  {
    id: "500-19645",
    description: "Slurry Valve, Knife Gate",
    manufacturer: "Weir",
    manufacturerPartNo: "SG-8IN-EPDM",
    specs: {
      Size: "8in",
      Seat: "EPDM",
      Actuator: "Pneumatic",
      Body: "Ductile iron",
    },
    category: "Milling",
    lifecycleStatus: "Active",
    lastPoPrice: 47200,
    lastPoDate: "5 Feb 2026",
    lastVendor: "Weir Minerals Africa",
    stockLevel: 2,
    leadTimeDays: 20,
  },

  // Electrical motors — Conveyance
  {
    id: "500-55210",
    description: "Motor, TEFC, 132kW 4-pole",
    manufacturer: "WEG",
    manufacturerPartNo: "W22-132M-4",
    specs: {
      Power: "132kW",
      Poles: "4",
      Frame: "315M",
      Efficiency: "IE3",
    },
    category: "Conveyance",
    lifecycleStatus: "Active",
    lastPoPrice: 98700,
    lastPoDate: "21 Oct 2025",
    lastVendor: "Zest WEG Group",
    stockLevel: 1,
    leadTimeDays: 25,
  },
]

export function getMaterialById(id: string): Material | undefined {
  return MATERIALS.find((m) => m.id === id)
}

// ---------------------------------------------------------------------------
// Alternate recommendations — keyed by material id.
// Populated for the materials referenced by the demo chat sessions below;
// the remaining catalog materials are ready for this shape when the
// /materials search page is built.
// ---------------------------------------------------------------------------

export const ALTERNATES: Record<string, AlternateRecommendation[]> = {
  "500-14892": [
    {
      id: "alt-14892-1",
      materialId: "500-14892",
      matchTier: "Direct equivalent",
      matchConfidence: 97,
      partNumber: "FLS-XR200-65V",
      manufacturer: "Flowserve",
      supplierId: "sup-bearings-intl",
      price: 38500,
      moq: 1,
      leadTimeDays: 12,
      specComparison: [
        { spec: "Shaft size", original: "65mm", alternate: "65mm", match: true },
        {
          spec: "Seal face",
          original: "SiC/SiC",
          alternate: "SiC/SiC",
          match: true,
        },
        {
          spec: "Elastomer",
          original: "Viton",
          alternate: "Viton",
          match: true,
        },
        {
          spec: "Pressure rating",
          original: "12 bar",
          alternate: "12 bar",
          match: true,
        },
      ],
      marketBenchmark: { low: 36800, high: 42100 },
    },
    {
      id: "alt-14892-2",
      materialId: "500-14892",
      matchTier: "Technical equivalent",
      matchConfidence: 89,
      partNumber: "5610-65-CC",
      manufacturer: "John Crane",
      supplierId: "sup-johncrane",
      price: 41200,
      moq: 1,
      leadTimeDays: 18,
      specComparison: [
        { spec: "Shaft size", original: "65mm", alternate: "65mm", match: true },
        {
          spec: "Seal face",
          original: "SiC/SiC",
          alternate: "Carbon/SiC",
          match: false,
        },
        {
          spec: "Elastomer",
          original: "Viton",
          alternate: "EPDM",
          match: false,
        },
        {
          spec: "Pressure rating",
          original: "12 bar",
          alternate: "16 bar",
          match: true,
        },
      ],
      marketBenchmark: { low: 36800, high: 42100 },
    },
    {
      id: "alt-14892-3",
      materialId: "500-14892",
      matchTier: "Technical equivalent",
      matchConfidence: 82,
      partNumber: "DS-65-VIT",
      manufacturer: "EagleBurgmann",
      supplierId: "sup-eagleburgmann",
      price: 44000,
      moq: 1,
      leadTimeDays: 25,
      specComparison: [
        { spec: "Shaft size", original: "65mm", alternate: "65mm", match: true },
        {
          spec: "Seal face",
          original: "SiC/SiC",
          alternate: "Carbon/SiC",
          match: false,
        },
        {
          spec: "Elastomer",
          original: "Viton",
          alternate: "Viton",
          match: true,
        },
        {
          spec: "Pressure rating",
          original: "12 bar",
          alternate: "14 bar",
          match: true,
        },
      ],
      marketBenchmark: { low: 36800, high: 42100 },
    },
  ],
  "500-22140": [
    {
      id: "alt-22140-1",
      materialId: "500-22140",
      matchTier: "Direct equivalent",
      matchConfidence: 98,
      partNumber: "SKF-22312-CC",
      manufacturer: "SKF",
      supplierId: "sup-bearings-intl",
      price: 7100,
      moq: 2,
      leadTimeDays: 5,
      specComparison: [
        { spec: "Bore", original: "60mm", alternate: "60mm", match: true },
        {
          spec: "Seal type",
          original: "Labyrinth",
          alternate: "Labyrinth",
          match: true,
        },
        {
          spec: "Load rating",
          original: "95kN",
          alternate: "95kN",
          match: true,
        },
      ],
      marketBenchmark: { low: 6800, high: 8900 },
    },
  ],
  "500-31005": [
    {
      id: "alt-31005-1",
      materialId: "500-31005",
      matchTier: "Technical equivalent",
      matchConfidence: 91,
      partNumber: "EJA430E-EAS4",
      manufacturer: "Yokogawa",
      supplierId: "sup-motioncontrol",
      price: 16200,
      moq: 1,
      leadTimeDays: 18,
      specComparison: [
        {
          spec: "Range",
          original: "0–16 bar",
          alternate: "0–10 bar",
          match: false,
        },
        {
          spec: "Output",
          original: "4-20mA HART",
          alternate: "4-20mA HART",
          match: true,
        },
        {
          spec: "Accuracy",
          original: "0.15%",
          alternate: "0.1%",
          match: false,
        },
      ],
      marketBenchmark: { low: 15500, high: 19800 },
    },
  ],
  "500-08823": [
    {
      id: "alt-08823-1",
      materialId: "500-08823",
      matchTier: "Direct equivalent",
      matchConfidence: 95,
      partNumber: "WMA-AH64-XREF",
      manufacturer: "Warman",
      supplierId: "sup-zestweg",
      price: 61800,
      moq: 1,
      leadTimeDays: 20,
      specComparison: [
        {
          spec: "Material",
          original: "High-chrome iron",
          alternate: "High-chrome iron",
          match: true,
        },
        {
          spec: "Vane config",
          original: "5-vane closed",
          alternate: "5-vane closed",
          match: true,
        },
        { spec: "Bore", original: "60mm", alternate: "60mm", match: true },
      ],
      marketBenchmark: { low: 59000, high: 70200 },
    },
  ],
}

export function getAlternatesForMaterial(
  materialId: string
): AlternateRecommendation[] {
  return ALTERNATES[materialId] ?? []
}

// ---------------------------------------------------------------------------
// Chat sessions
// ---------------------------------------------------------------------------

export const CHAT_SESSIONS: ChatSession[] = [
  // 1. Pump seal — Milling — the hero demo, in-progress at alternate selection
  {
    id: "SPR-2847",
    title: "Pump seal — Milling unit 3",
    navLabel: "Pump seal — Milling",
    navSubtitle: "3 alternates found",
    category: "Milling",
    status: "in_progress",
    materialId: "500-14892",
    requester: "M. Naidoo",
    date: "22 Jul 2026",
    messages: [
      {
        id: "seal-1",
        role: "user",
        authorLabel: "You",
        timestamp: "10:23 AM",
        text: "I need an alternate supplier for material 500-14892 — mechanical seal for the milling pump",
      },
      {
        id: "seal-2",
        role: "ai",
        authorLabel: "Spares AI",
        timestamp: "10:23 AM",
        text: 'I found material **500-14892** — currently described as "Seal Assy, Mech Type XR-200, Flowserve". Let me confirm the application context so I can find the right alternates.\n\n**Which equipment is this installed on?**',
        options: {
          id: "seal-equipment",
          defaultSelectedId: "warman",
          locked: true,
          resolvedAt: "10:24 AM",
          options: [
            {
              id: "warman",
              icon: "settings",
              label: "Warman 8/6 AH slurry pump",
              description: "Milling circuit — primary grind",
            },
            {
              id: "metso",
              icon: "settings",
              label: "Metso HM150 pump",
              description: "Milling circuit — cyclone feed",
            },
            {
              id: "other",
              icon: "help",
              label: "Not sure / other equipment",
              description: "I'll describe the application manually",
            },
          ],
        },
        footerNote: "Selection logged for traceability",
      },
      {
        id: "seal-4",
        role: "ai",
        authorLabel: "Spares AI",
        timestamp: "10:24 AM",
        text: "Got it. Based on the Warman 8/6 AH application, I've matched the specs: **shaft size 65mm, seal face SiC/SiC, elastomer Viton, rated to 12 bar**.\n\nI found **3 alternate options**. What match tier are you looking for?",
        options: {
          id: "seal-tier",
          defaultSelectedId: "direct",
          options: [
            {
              id: "direct",
              icon: "copy",
              label: "Direct equivalent",
              description:
                "Same OEM part from different distributor — light approval",
            },
            {
              id: "technical",
              icon: "sliders",
              label: "Technical equivalent",
              description:
                "Different manufacturer, same specs — engineering sign-off",
            },
            {
              id: "all",
              icon: "lightbulb",
              label: "Show all tiers",
              description: "See all 3 options with price comparison",
            },
          ],
        },
        footerNote: "Tier selection determines approval workflow",
      },
      {
        id: "seal-5",
        role: "ai",
        authorLabel: "Spares AI",
        timestamp: "10:25 AM",
        comparison: {
          id: "seal-comparison",
          heading: "Direct equivalent found",
          current: {
            label: "Current supplier",
            supplierName: "Flowserve SA",
            partNumber: "XR-200-65-VV",
            price: 48200,
            meta: "Last PO: 14 Mar 2026",
          },
          alternate: {
            label: "Alternate — direct equivalent",
            supplierName: "Bearings Int'l (Pty)",
            partNumber: "FLS-XR200-65V",
            price: 38500,
            meta: "",
            savingsPct: 20,
          },
          benchmark: {
            low: 36800,
            high: 42100,
            note: "Alternate is within range.",
          },
        },
        actions: {
          id: "seal-actions",
          accentId: "proceed",
          actions: [
            {
              id: "proceed",
              icon: "send",
              label: "Proceed with alternate",
              description: "Triggers approval workflow and notifies stakeholders",
            },
            {
              id: "view-technical",
              icon: "eye",
              label: "View technical equivalents too",
              description: "See options from other manufacturers",
            },
            {
              id: "export",
              icon: "file-text",
              label: "Export comparison report",
              description: "PDF for offline review with engineering",
            },
          ],
        },
      },
    ],
    workflow: [
      {
        id: "material-identified",
        label: "Material identified",
        status: "done",
        meta: "Auto · 10:23",
      },
      {
        id: "application-confirmed",
        label: "Application confirmed",
        status: "done",
        meta: "User · 10:24",
      },
      {
        id: "alternate-selection",
        label: "Alternate selection",
        status: "active",
        meta: "Awaiting user",
      },
      { id: "procurement-approval", label: "Procurement approval", status: "pending" },
      { id: "engineering-signoff", label: "Engineering sign-off", status: "pending" },
      { id: "po-generation", label: "PO generation", status: "pending" },
    ],
    emails: [
      {
        id: "seal-email-1",
        status: "sent",
        text: "Session started alert sent to procurement team",
        time: "10:23 AM",
      },
      {
        id: "seal-email-2",
        status: "pending",
        text: "Approval reminder queued for R. Patel (Procurement head)",
        time: "Triggers on selection",
      },
      {
        id: "seal-email-3",
        status: "escalated",
        text: "Auto-escalation to VP Supply Chain if no response in 24h",
        time: "Configured",
      },
    ],
    trace: {
      tags: [
        { label: "Milling", kind: "cat" },
        { label: "Direct equiv.", kind: "tier" },
        { label: "In progress", kind: "status" },
      ],
      material: "500-14892",
      equipment: "Warman 8/6 AH",
      requester: "M. Naidoo",
      specMatch: "65mm / SiC / Viton",
      selectionsDone: 2,
      selectionsTotal: 6,
    },
  },

  // 2. Conveyor bearing — Conveyance — awaiting alternate decision
  {
    id: "SPR-2851",
    title: "Conveyor bearing — CV-14 stacker",
    navLabel: "Conveyor bearing",
    navSubtitle: "Awaiting decision",
    navBadge: { type: "count", value: 1 },
    category: "Conveyance",
    status: "in_progress",
    materialId: "500-22140",
    requester: "T. Mokoena",
    date: "21 Jul 2026",
    messages: [
      {
        id: "brg-1",
        role: "user",
        authorLabel: "You",
        timestamp: "8:12 AM",
        text: "Need alternate for material 500-22140 — troughing idler bearing on the stacker conveyor, current one's on back order",
      },
      {
        id: "brg-2",
        role: "ai",
        authorLabel: "Spares AI",
        timestamp: "8:12 AM",
        text: 'Found material **500-22140** — "Bearing, Spherical Roller, Conveyor Idler", SKF, currently sourced through BMG.\n\n**Which conveyor is this for?**',
        options: {
          id: "brg-conveyor",
          defaultSelectedId: "cv14",
          locked: true,
          resolvedAt: "8:14 AM",
          options: [
            {
              id: "cv14",
              icon: "settings",
              label: "CV-14 stacker conveyor",
              description: "Troughing idler — drive end",
            },
            {
              id: "cv09",
              icon: "settings",
              label: "CV-09 overland conveyor",
              description: "Return idler",
            },
            {
              id: "other",
              icon: "help",
              label: "Not sure / other equipment",
              description: "I'll describe the application manually",
            },
          ],
        },
        footerNote: "Selection logged for traceability",
      },
      {
        id: "brg-4",
        role: "ai",
        authorLabel: "Spares AI",
        timestamp: "8:15 AM",
        text: "Confirmed — bore 60mm, labyrinth seal, 95kN load rating. I found a direct equivalent already in stock at a nearby distributor.",
        comparison: {
          id: "brg-comparison",
          heading: "Direct equivalent found",
          current: {
            label: "Current supplier",
            supplierName: "BMG (Bearing Man Group)",
            partNumber: "SKF-22312-CC",
            price: 8400,
            meta: "Last PO: 11 Mar 2026",
          },
          alternate: {
            label: "Alternate — direct equivalent",
            supplierName: "Bearings Int'l (Pty)",
            partNumber: "SKF-22312-CC",
            price: 7100,
            meta: "",
            savingsPct: 15,
          },
          benchmark: {
            low: 6800,
            high: 8900,
            note: "Alternate is within range.",
          },
        },
        actions: {
          id: "brg-actions",
          accentId: "proceed",
          // Left unresolved so the user can still pick an action and Continue.
          actions: [
            {
              id: "proceed",
              icon: "send",
              label: "Proceed with alternate",
              description: "Triggers approval workflow and notifies stakeholders",
            },
            {
              id: "view-technical",
              icon: "eye",
              label: "View technical equivalents too",
              description: "See options from other manufacturers",
            },
            {
              id: "export",
              icon: "file-text",
              label: "Export comparison report",
              description: "PDF for offline review with engineering",
            },
          ],
        },
      },
    ],
    workflow: [
      {
        id: "material-identified",
        label: "Material identified",
        status: "done",
        meta: "Auto · 08:12",
      },
      {
        id: "application-confirmed",
        label: "Application confirmed",
        status: "done",
        meta: "User · 08:14",
      },
      {
        id: "alternate-selection",
        label: "Alternate selection",
        status: "active",
        meta: "Awaiting selection",
      },
      {
        id: "procurement-approval",
        label: "Procurement approval",
        status: "pending",
        meta: "Awaiting R. Patel",
      },
      { id: "engineering-signoff", label: "Engineering sign-off", status: "pending" },
      { id: "po-generation", label: "PO generation", status: "pending" },
    ],
    emails: [
      {
        id: "brg-email-1",
        status: "sent",
        text: "Session started alert sent to procurement team",
        time: "8:12 AM",
      },
      {
        id: "brg-email-2",
        status: "pending",
        text: "Approval reminder queued for R. Patel (Procurement head)",
        time: "Triggers in 6h",
      },
      {
        id: "brg-email-3",
        status: "escalated",
        text: "Auto-escalation to VP Supply Chain if no response in 24h",
        time: "Configured",
      },
    ],
    trace: {
      tags: [
        { label: "Conveyance", kind: "cat" },
        { label: "Direct equiv.", kind: "tier" },
        { label: "In progress", kind: "status" },
      ],
      material: "500-22140",
      equipment: "CV-14 stacker conveyor",
      requester: "T. Mokoena",
      specMatch: "60mm / Labyrinth / 95kN",
      selectionsDone: 2,
      selectionsTotal: 6,
    },
  },

  // 3. Pressure transmitter — Instrumentation — escalated, no response in 24h
  {
    id: "SPR-2839",
    title: "Pressure transmitter — Flotation bank 2",
    navLabel: "Pressure transmitter",
    navSubtitle: "Escalated",
    navBadge: { type: "alert" },
    category: "Instrumentation",
    status: "escalated",
    materialId: "500-31005",
    requester: "S. van Wyk",
    date: "18 Jul 2026",
    messages: [
      {
        id: "pt-1",
        role: "user",
        authorLabel: "You",
        timestamp: "7:40 AM",
        text: "Endress+Hauser transmitter 500-31005 keeps drifting out of cal — need an alternate for the reagent dosing skid on flotation bank 2",
      },
      {
        id: "pt-2",
        role: "ai",
        authorLabel: "Spares AI",
        timestamp: "7:41 AM",
        text: 'Found material **500-31005** — "Pressure Transmitter, Cerabar PMC21", Endress+Hauser.\n\n**Which loop is this installed on?**',
        options: {
          id: "pt-loop",
          defaultSelectedId: "dosing",
          locked: true,
          resolvedAt: "7:42 AM",
          options: [
            {
              id: "dosing",
              icon: "settings",
              label: "Reagent dosing skid — bank 2",
              description: "Flotation reagent circuit",
            },
            {
              id: "thickener",
              icon: "settings",
              label: "Thickener underflow loop",
              description: "Flotation tailings circuit",
            },
            {
              id: "other",
              icon: "help",
              label: "Not sure / other equipment",
              description: "I'll describe the application manually",
            },
          ],
        },
        footerNote: "Selection logged for traceability",
      },
      {
        id: "pt-4",
        role: "ai",
        authorLabel: "Spares AI",
        timestamp: "7:43 AM",
        text: "Matched specs: **range 0–16 bar, 4-20mA HART, 0.15% accuracy**. I found 2 alternate options. What match tier are you looking for?",
        options: {
          id: "pt-tier",
          defaultSelectedId: "technical",
          locked: true,
          resolvedAt: "7:44 AM",
          options: [
            {
              id: "direct",
              icon: "copy",
              label: "Direct equivalent",
              description: "Same OEM part from different distributor — light approval",
            },
            {
              id: "technical",
              icon: "sliders",
              label: "Technical equivalent",
              description:
                "Different manufacturer, tighter accuracy — engineering sign-off",
            },
            {
              id: "all",
              icon: "lightbulb",
              label: "Show all tiers",
              description: "See all options with price comparison",
            },
          ],
        },
        footerNote: "Tier selection determines approval workflow",
      },
      {
        id: "pt-5",
        role: "ai",
        authorLabel: "Spares AI",
        timestamp: "7:44 AM",
        comparison: {
          id: "pt-comparison",
          heading: "Technical equivalent found",
          current: {
            label: "Current supplier",
            supplierName: "Becker Mining SA",
            partNumber: "PMC21-A1F1H",
            price: 18900,
            meta: "Last PO: 27 Feb 2026",
          },
          alternate: {
            label: "Alternate — technical equivalent",
            supplierName: "Motion Control Systems",
            partNumber: "EJA430E-EAS4",
            price: 16200,
            meta: "",
            savingsPct: 14,
          },
          benchmark: {
            low: 15500,
            high: 19800,
            note: "Alternate is within range.",
          },
        },
        actions: {
          id: "pt-actions",
          accentId: "proceed",
          resolvedActionId: "proceed",
          actions: [
            {
              id: "proceed",
              icon: "send",
              label: "Proceed with alternate",
              description: "Triggers approval workflow and notifies stakeholders",
            },
            {
              id: "view-technical",
              icon: "eye",
              label: "View technical equivalents too",
              description: "See options from other manufacturers",
            },
            {
              id: "export",
              icon: "file-text",
              label: "Export comparison report",
              description: "PDF for offline review with engineering",
            },
          ],
        },
      },
      {
        id: "pt-6",
        role: "ai",
        authorLabel: "Spares AI",
        timestamp: "Next day · 8:10 AM",
        text: "This request has not received engineering sign-off within 24 hours. It has been **auto-escalated to L. Naidoo (VP Supply Chain)** for review.",
      },
    ],
    workflow: [
      {
        id: "material-identified",
        label: "Material identified",
        status: "done",
        meta: "Auto · 07:41",
      },
      {
        id: "application-confirmed",
        label: "Application confirmed",
        status: "done",
        meta: "User · 07:42",
      },
      {
        id: "alternate-selection",
        label: "Alternate selection",
        status: "done",
        meta: "User · 07:44",
      },
      {
        id: "procurement-approval",
        label: "Procurement approval",
        status: "done",
        meta: "Approved · 07:50",
      },
      {
        id: "engineering-signoff",
        label: "Engineering sign-off",
        status: "active",
        meta: "Overdue — escalated",
        tone: "danger",
      },
      { id: "po-generation", label: "PO generation", status: "pending" },
    ],
    emails: [
      {
        id: "pt-email-1",
        status: "sent",
        text: "Session started alert sent to procurement team",
        time: "7:41 AM",
      },
      {
        id: "pt-email-2",
        status: "sent",
        text: "Engineering sign-off request sent to P. Govender",
        time: "7:44 AM",
      },
      {
        id: "pt-email-3",
        status: "escalated",
        text: "Escalated to L. Naidoo (VP Supply Chain) — no response in 24h",
        time: "Next day · 8:10 AM",
      },
    ],
    trace: {
      tags: [
        { label: "Instrumentation", kind: "cat" },
        { label: "Technical equiv.", kind: "tier" },
        { label: "Escalated", kind: "status" },
      ],
      material: "500-31005",
      equipment: "Reagent dosing skid — bank 2",
      requester: "S. van Wyk",
      specMatch: "0–16 bar / HART / 0.15%",
      selectionsDone: 4,
      selectionsTotal: 6,
    },
  },

  // 4. Impeller — Flotation — completed, PO generated
  {
    id: "SPR-2802",
    title: "Impeller — Flotation feed pump FP-2",
    navLabel: "Impeller — Flotation",
    navSubtitle: "PO generated",
    category: "Flotation",
    status: "completed",
    materialId: "500-08823",
    requester: "K. Dlamini",
    date: "15 Jul 2026",
    messages: [
      {
        id: "imp-1",
        role: "user",
        authorLabel: "You",
        timestamp: "9:02 AM",
        text: "Impeller on FP-2 is showing heavy wear, need a replacement or alternate — material 500-08823",
      },
      {
        id: "imp-2",
        role: "ai",
        authorLabel: "Spares AI",
        timestamp: "9:03 AM",
        text: 'Found material **500-08823** — "Impeller, Slurry Pump, AH 6/4", Warman, current source Weir Minerals Africa.\n\n**Which pump is this for?**',
        options: {
          id: "imp-pump",
          defaultSelectedId: "fp2",
          locked: true,
          resolvedAt: "9:05 AM",
          options: [
            {
              id: "fp2",
              icon: "settings",
              label: "FP-2 flotation feed pump",
              description: "Warman AH 6/4",
            },
            {
              id: "fp1",
              icon: "settings",
              label: "FP-1 flotation feed pump",
              description: "Warman AH 6/4",
            },
            {
              id: "other",
              icon: "help",
              label: "Not sure / other equipment",
              description: "I'll describe the application manually",
            },
          ],
        },
        footerNote: "Selection logged for traceability",
      },
      {
        id: "imp-4",
        role: "ai",
        authorLabel: "Spares AI",
        timestamp: "9:06 AM",
        text: "Matched specs: **high-chrome iron, 5-vane closed, 60mm bore, heavy slurry duty**. Found 2 alternate options. What match tier are you looking for?",
        options: {
          id: "imp-tier",
          defaultSelectedId: "direct",
          locked: true,
          resolvedAt: "9:07 AM",
          options: [
            {
              id: "direct",
              icon: "copy",
              label: "Direct equivalent",
              description: "Same OEM part from different distributor — light approval",
            },
            {
              id: "technical",
              icon: "sliders",
              label: "Technical equivalent",
              description: "Different manufacturer, same specs — engineering sign-off",
            },
            {
              id: "all",
              icon: "lightbulb",
              label: "Show all tiers",
              description: "See all options with price comparison",
            },
          ],
        },
        footerNote: "Tier selection determines approval workflow",
      },
      {
        id: "imp-5",
        role: "ai",
        authorLabel: "Spares AI",
        timestamp: "9:07 AM",
        comparison: {
          id: "imp-comparison",
          heading: "Direct equivalent found",
          current: {
            label: "Current supplier",
            supplierName: "Weir Minerals Africa",
            partNumber: "AH-6-4-IMP-HC",
            price: 74500,
            meta: "Last PO: 18 Mar 2026",
          },
          alternate: {
            label: "Alternate — direct equivalent",
            supplierName: "Zest WEG Group",
            partNumber: "WMA-AH64-XREF",
            price: 61800,
            meta: "",
            savingsPct: 17,
          },
          benchmark: {
            low: 59000,
            high: 70200,
            note: "Alternate is within range.",
          },
        },
        actions: {
          id: "imp-actions",
          accentId: "proceed",
          resolvedActionId: "proceed",
          actions: [
            {
              id: "proceed",
              icon: "send",
              label: "Proceed with alternate",
              description: "Triggers approval workflow and notifies stakeholders",
            },
            {
              id: "view-technical",
              icon: "eye",
              label: "View technical equivalents too",
              description: "See options from other manufacturers",
            },
            {
              id: "export",
              icon: "file-text",
              label: "Export comparison report",
              description: "PDF for offline review with engineering",
            },
          ],
        },
      },
      {
        id: "imp-6",
        role: "ai",
        authorLabel: "Spares AI",
        timestamp: "9:12 AM",
        text: "**Approved by R. Patel** (procurement) and **signed off by P. Govender** (engineering). Purchase order **PO-48291** has been generated and sent to Zest WEG Group.",
      },
    ],
    workflow: [
      {
        id: "material-identified",
        label: "Material identified",
        status: "done",
        meta: "Auto · 09:03",
      },
      {
        id: "application-confirmed",
        label: "Application confirmed",
        status: "done",
        meta: "User · 09:05",
      },
      {
        id: "alternate-selection",
        label: "Alternate selection",
        status: "done",
        meta: "User · 09:07",
      },
      {
        id: "procurement-approval",
        label: "Procurement approval",
        status: "done",
        meta: "Approved · 09:09",
      },
      {
        id: "engineering-signoff",
        label: "Engineering sign-off",
        status: "done",
        meta: "Signed off · 09:11",
      },
      {
        id: "po-generation",
        label: "PO generation",
        status: "done",
        meta: "PO-48291 · 09:12",
      },
    ],
    emails: [
      {
        id: "imp-email-1",
        status: "sent",
        text: "Session started alert sent to procurement team",
        time: "9:03 AM",
      },
      {
        id: "imp-email-2",
        status: "sent",
        text: "Approval granted by R. Patel (Procurement head)",
        time: "9:09 AM",
      },
      {
        id: "imp-email-3",
        status: "sent",
        text: "PO-48291 generated and sent to Zest WEG Group",
        time: "9:12 AM",
      },
    ],
    trace: {
      tags: [
        { label: "Flotation", kind: "cat" },
        { label: "Direct equiv.", kind: "tier" },
        { label: "Completed", kind: "status" },
      ],
      material: "500-08823",
      equipment: "FP-2 flotation feed pump",
      requester: "K. Dlamini",
      specMatch: "60mm / 5-vane / HC iron",
      selectionsDone: 6,
      selectionsTotal: 6,
    },
  },

  // 5. Control valve — Milling — escalated: requester never picked a match
  // tier, so the request timed out and auto-escalated (a distinct trigger
  // from SPR-2839, which stalled on an approver instead of the requester).
  {
    id: "SPR-2860",
    title: "Control valve — Reagent dosing line",
    navLabel: "Control valve",
    navSubtitle: "Escalated",
    navBadge: { type: "alert" },
    category: "Milling",
    status: "escalated",
    materialId: "500-19560",
    requester: "R. Abrahams",
    date: "21 Jul 2026",
    messages: [
      {
        id: "valve-1",
        role: "user",
        authorLabel: "You",
        timestamp: "2:02 PM",
        text: "The reagent dosing control valve keeps sticking, need an alternate — material 500-19560",
      },
      {
        id: "valve-2",
        role: "ai",
        authorLabel: "Spares AI",
        timestamp: "2:03 PM",
        text: 'Found material **500-19560** — "Control Valve, Globe, easy-E", Fisher, currently sourced through Motion Control Systems. Let me confirm the application context.\n\n**Which line is this installed on?**',
        options: {
          id: "valve-line",
          defaultSelectedId: "reagent",
          locked: true,
          resolvedAt: "2:04 PM",
          options: [
            {
              id: "reagent",
              icon: "settings",
              label: "Reagent dosing line",
              description: "Milling circuit",
            },
            {
              id: "lime",
              icon: "settings",
              label: "Lime slurry line",
              description: "Milling circuit",
            },
            {
              id: "other",
              icon: "help",
              label: "Not sure / other equipment",
              description: "I'll describe the application manually",
            },
          ],
        },
        footerNote: "Selection logged for traceability",
      },
      {
        id: "valve-3",
        role: "ai",
        authorLabel: "Spares AI",
        timestamp: "2:05 PM",
        text: "Got it — reagent dosing line, milling circuit. Matched specs: **3in, equal % trim, 667 spring-diaphragm actuator**. Found 2 alternate options. What match tier are you looking for?",
        options: {
          id: "valve-tier",
          // No defaultSelectedId — this one was asked and never answered.
          locked: true,
          options: [
            {
              id: "direct",
              icon: "copy",
              label: "Direct equivalent",
              description: "Same OEM part from different distributor — light approval",
            },
            {
              id: "technical",
              icon: "sliders",
              label: "Technical equivalent",
              description: "Different manufacturer, same specs — engineering sign-off",
            },
            {
              id: "all",
              icon: "lightbulb",
              label: "Show all tiers",
              description: "See all options with price comparison",
            },
          ],
        },
        footerNote: "Tier selection determines approval workflow",
      },
      {
        id: "valve-4",
        role: "ai",
        authorLabel: "Spares AI",
        timestamp: "Next day · 2:10 PM",
        text: "We haven't heard back on the match tier for this request in 24 hours. It has been **auto-escalated to L. Naidoo (VP Supply Chain)** for review.",
      },
    ],
    workflow: [
      {
        id: "material-identified",
        label: "Material identified",
        status: "done",
        meta: "Auto · 14:03",
      },
      {
        id: "application-confirmed",
        label: "Application confirmed",
        status: "done",
        meta: "User · 14:04",
      },
      {
        id: "alternate-selection",
        label: "Alternate selection",
        status: "active",
        meta: "Overdue — no response, escalated",
        tone: "danger",
      },
      { id: "procurement-approval", label: "Procurement approval", status: "pending" },
      { id: "engineering-signoff", label: "Engineering sign-off", status: "pending" },
      { id: "po-generation", label: "PO generation", status: "pending" },
    ],
    emails: [
      {
        id: "valve-email-1",
        status: "sent",
        text: "Session started alert sent to procurement team",
        time: "2:03 PM",
      },
      {
        id: "valve-email-2",
        status: "sent",
        text: "Reminder sent to R. Abrahams — match tier decision pending",
        time: "2:05 PM",
      },
      {
        id: "valve-email-3",
        status: "escalated",
        text: "Escalated to L. Naidoo (VP Supply Chain) — no response from requester in 24h",
        time: "Next day · 2:10 PM",
      },
    ],
    trace: {
      tags: [
        { label: "Milling", kind: "cat" },
        { label: "Escalated", kind: "status" },
      ],
      material: "500-19560",
      equipment: "Reagent dosing line",
      requester: "R. Abrahams",
      specMatch: "3in / Equal% / 667 actuator",
      selectionsDone: 2,
      selectionsTotal: 6,
    },
  },

  // 6. Blank draft — opened by sidebar "New session" (mock: type freely, no AI replies)
  {
    id: NEW_SESSION_ID,
    title: "New session",
    navLabel: "New session",
    navSubtitle: "Draft",
    category: "Milling",
    status: "new",
    materialId: "—",
    requester: "You",
    date: "22 Jul 2026",
    messages: [],
    workflow: [
      {
        id: "material-identified",
        label: "Material identified",
        status: "active",
        meta: "Awaiting input",
      },
      {
        id: "application-confirmed",
        label: "Application confirmed",
        status: "pending",
      },
      { id: "alternate-selection", label: "Alternate selection", status: "pending" },
      { id: "procurement-approval", label: "Procurement approval", status: "pending" },
      { id: "engineering-signoff", label: "Engineering sign-off", status: "pending" },
      { id: "po-generation", label: "PO generation", status: "pending" },
    ],
    emails: [],
    trace: {
      tags: [{ label: "Draft", kind: "status" }],
      material: "—",
      equipment: "—",
      requester: "You",
      specMatch: "—",
      selectionsDone: 0,
      selectionsTotal: 6,
    },
  },
]

export function getSessionById(id: string): ChatSession | undefined {
  return CHAT_SESSIONS.find((s) => s.id === id)
}

/** Sessions surfaced in the sidebar — completed sessions roll off the active list. */
export function getActiveSessions(): ChatSession[] {
  return CHAT_SESSIONS.filter((s) => s.status !== "completed")
}

/** Synthesizes a fresh "material identification" session for any catalog material — used by /materials row clicks. */
export function createDraftSession(material: Material): ChatSession {
  const categoryLabel = material.category.toLowerCase()

  return {
    id: `NEW-${material.id}`,
    title: `${material.description} — ${material.category}`,
    navLabel: material.description,
    navSubtitle: "New session",
    category: material.category,
    status: "new",
    materialId: material.id,
    requester: "You",
    date: "22 Jul 2026",
    messages: [
      {
        id: "draft-1",
        role: "user",
        authorLabel: "You",
        timestamp: "Just now",
        text: `I need an alternate supplier for material ${material.id} — ${material.description}`,
      },
      {
        id: "draft-2",
        role: "ai",
        authorLabel: "Spares AI",
        timestamp: "Just now",
        text: `Found material **${material.id}** — currently described as "${material.description}", ${material.manufacturer}, sourced through ${material.lastVendor}. Let me confirm the application context so I can find the right alternates.\n\n**Which equipment is this installed on?**`,
        options: {
          id: "draft-equipment",
          defaultSelectedId: "primary",
          advancesWorkflow: true,
          options: [
            {
              id: "primary",
              icon: "settings",
              label: `Primary ${categoryLabel} application`,
              description: "Most common installation for this material",
            },
            {
              id: "secondary",
              icon: "settings",
              label: "Secondary / standby unit",
              description: "Redundant or backup equipment",
            },
            {
              id: "other",
              icon: "help",
              label: "Not sure / other equipment",
              description: "I'll describe the application manually",
            },
          ],
        },
        footerNote: "Selection logged for traceability",
      },
      {
        id: "draft-3",
        role: "ai",
        authorLabel: "Spares AI",
        timestamp: "Just now",
        text: `Thanks — matching specs for that application now. I'll have alternate options for **${material.id}** ready shortly.`,
      },
    ],
    workflow: [
      {
        id: "material-identified",
        label: "Material identified",
        status: "done",
        meta: "Auto · just now",
      },
      {
        id: "application-confirmed",
        label: "Application confirmed",
        status: "active",
        meta: "Awaiting user",
      },
      { id: "alternate-selection", label: "Alternate selection", status: "pending" },
      { id: "procurement-approval", label: "Procurement approval", status: "pending" },
      { id: "engineering-signoff", label: "Engineering sign-off", status: "pending" },
      { id: "po-generation", label: "PO generation", status: "pending" },
    ],
    emails: [
      {
        id: "draft-email-1",
        status: "sent",
        text: "Session started alert sent to procurement team",
        time: "Just now",
      },
      {
        id: "draft-email-2",
        status: "pending",
        text: "Approval reminder queued for R. Patel (Procurement head)",
        time: "Triggers on selection",
      },
      {
        id: "draft-email-3",
        status: "escalated",
        text: "Auto-escalation to VP Supply Chain if no response in 24h",
        time: "Configured",
      },
    ],
    trace: {
      tags: [
        { label: material.category, kind: "cat" },
        { label: "New", kind: "status" },
      ],
      material: material.id,
      equipment: "Pending confirmation",
      requester: "You",
      specMatch: "Pending",
      selectionsDone: 1,
      selectionsTotal: 6,
    },
  }
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export const SAVINGS_TREND: SavingsTrendPoint[] = [
  { month: "Feb", savings: 148000 },
  { month: "Mar", savings: 176500 },
  { month: "Apr", savings: 205000 },
  { month: "May", savings: 231000 },
  { month: "Jun", savings: 268000 },
  { month: "Jul", savings: 296000 },
]

export const CATEGORY_BREAKDOWN: CategoryBreakdownPoint[] = [
  { category: "Milling", value: 14 },
  { category: "Conveyance", value: 9 },
  { category: "Flotation", value: 7 },
  { category: "Instrumentation", value: 5 },
]

export function getDashboardSummary(): DashboardSummary {
  return {
    activeSessions: getActiveSessions().length,
    alternatesFoundThisMonth: CATEGORY_BREAKDOWN.reduce((sum, c) => sum + c.value, 0),
    costSavingsZAR: SAVINGS_TREND.reduce((sum, p) => sum + p.savings, 0),
    pendingApprovals: PENDING_APPROVALS.length,
  }
}

// ---------------------------------------------------------------------------
// Approvals queue
// ---------------------------------------------------------------------------

export const PENDING_APPROVALS: PendingApproval[] = [
  {
    id: "appr-1",
    sessionId: "SPR-2847",
    materialId: "500-14892",
    materialDescription: "Seal Assy, Mech Type XR-200",
    requester: "M. Naidoo",
    matchTier: "Direct equivalent",
    savingsPct: 20,
    waitingSince: "22 Jul 2026 · 10:25 AM",
    approver: "R. Patel",
    category: "Milling",
    urgency: "Normal",
  },
  {
    id: "appr-2",
    sessionId: "SPR-2851",
    materialId: "500-22140",
    materialDescription: "Bearing, Spherical Roller, Conveyor Idler",
    requester: "T. Mokoena",
    matchTier: "Direct equivalent",
    savingsPct: 15,
    waitingSince: "21 Jul 2026 · 08:15 AM",
    approver: "R. Patel",
    category: "Conveyance",
    urgency: "High",
  },
  {
    id: "appr-3",
    sessionId: "SPR-2839",
    materialId: "500-31005",
    materialDescription: "Pressure Transmitter, Cerabar PMC21",
    requester: "S. van Wyk",
    matchTier: "Technical equivalent",
    savingsPct: 14,
    waitingSince: "18 Jul 2026 · 07:44 AM",
    approver: "P. Govender",
    category: "Instrumentation",
    urgency: "Critical",
  },
  {
    id: "appr-4",
    sessionId: "SPR-2871",
    materialId: "500-19602",
    materialDescription: "Control Valve, Rotary, Neldisc",
    requester: "L. Ndlovu",
    matchTier: "Direct equivalent",
    savingsPct: 11,
    waitingSince: "20 Jul 2026 · 2:30 PM",
    approver: "R. Patel",
    category: "Milling",
    urgency: "Normal",
  },
]

// ---------------------------------------------------------------------------
// Audit trail — derived from the chat sessions above, so it can never drift
// from what actually happened in a conversation.
// ---------------------------------------------------------------------------

export function getAuditLog(): AuditEntry[] {
  const entries: AuditEntry[] = []

  for (const session of CHAT_SESSIONS) {
    for (const message of session.messages) {
      const actor = message.role === "user" ? "User" : "AI"
      const plainText = (message.text ?? "")
        .replace(/\*\*/g, "")
        .replace(/\n+/g, " ")
        .trim()

      if (message.comparison) {
        const c = message.comparison
        entries.push({
          id: `${message.id}-msg`,
          timestamp: message.timestamp,
          sessionId: session.id,
          action: "Alternate comparison shown",
          actor: "AI",
          material: session.materialId,
          detail: `${c.heading}: ${c.alternate.supplierName} vs ${c.current.supplierName}`,
          fullDetail: `${c.heading}. Current: ${c.current.supplierName} (${c.current.partNumber}) at ${formatZAR(c.current.price)}. Alternate: ${c.alternate.supplierName} (${c.alternate.partNumber}) at ${formatZAR(c.alternate.price)}${c.alternate.savingsPct !== undefined ? `, ${c.alternate.savingsPct}% below current` : ""}. Market benchmark ${formatZAR(c.benchmark.low)}–${formatZAR(c.benchmark.high)}.`,
        })
      } else if (message.options) {
        entries.push({
          id: `${message.id}-msg`,
          timestamp: message.timestamp,
          sessionId: session.id,
          action: message.role === "user" ? "User request" : "Options presented",
          actor,
          material: session.materialId,
          detail: plainText.slice(0, 140) || "—",
          fullDetail: `${plainText} — Options: ${message.options.options.map((o) => o.label).join(", ")}`,
        })

        if (message.options.locked && message.options.defaultSelectedId) {
          const chosen = message.options.options.find(
            (o) => o.id === message.options?.defaultSelectedId
          )
          entries.push({
            id: `${message.id}-selection`,
            timestamp: message.options.resolvedAt ?? message.timestamp,
            sessionId: session.id,
            action: "User selection",
            actor: "User",
            material: session.materialId,
            detail: `Selected: ${chosen?.label ?? message.options.defaultSelectedId}`,
            fullDetail: `User selected "${chosen?.label ?? message.options.defaultSelectedId}" in response to: ${plainText}`,
          })
        }
      } else {
        entries.push({
          id: `${message.id}-msg`,
          timestamp: message.timestamp,
          sessionId: session.id,
          action: message.role === "user" ? "User message" : "AI response",
          actor,
          material: session.materialId,
          detail: plainText.slice(0, 140) || "—",
          fullDetail: plainText,
        })
      }

      if (message.actions?.resolvedActionId) {
        const chosen = message.actions.actions.find(
          (a) => a.id === message.actions?.resolvedActionId
        )
        entries.push({
          id: `${message.id}-action`,
          timestamp: message.timestamp,
          sessionId: session.id,
          action: "Action taken",
          actor: "User",
          material: session.materialId,
          detail: `Selected: ${chosen?.label ?? message.actions.resolvedActionId}`,
          fullDetail: `User selected "${chosen?.label ?? message.actions.resolvedActionId}" — ${chosen?.description ?? "no further detail"}.`,
        })
      }
    }
  }

  return entries
}
