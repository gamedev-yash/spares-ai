// Server-only: reads and parses src/lib/data/material_extension.csv once at
// module load, joining Initiative 9's MATERIALS (by material ID) with the
// plant, criticality, planning, and repair fields Initiatives 7, 8, and 13
// need but Material doesn't have. This module touches Node's `fs` — import
// it only from Server Components and pass the results down as props; never
// import it from a "use client" file.
import fs from "fs"
import path from "path"

import { parseCsvRecords } from "@/lib/csv"
import { MATERIALS } from "@/lib/mock-data"
import type {
  Circuit,
  CriticalityClass,
  Material,
  PlanningCategory,
  VziUnit,
} from "@/lib/types"

const CSV_PATH = path.join(
  process.cwd(),
  "src/lib/data/material_extension.csv"
)

const ROWS: Record<string, string>[] = parseCsvRecords(
  fs.readFileSync(CSV_PATH, "utf-8")
).filter((r) => r.section === "extension")

const num = (v: string) => Number(v || 0)
const bool = (v: string) => v === "true"

export type MaterialExtension = {
  materialId: string
  plant: VziUnit
  /** the Initiative 12 seam — left empty until duplicate-code cleansing lands */
  canonicalMaterialId?: string
  criticalityClass?: CriticalityClass
  circuit?: Circuit
  /** provisional — see docs/IMPLEMENTATION_BLUEPRINT.md section 2 */
  planningCategory: PlanningCategory
  materialGroup?: string
  /** the Initiative 11 seam */
  mrpType?: string
  isRepairable: boolean
  /** the 80-series code, if repair and new-unit procurement don't share one */
  repairMaterialCode?: string
  currentRop: number
  currentSafetyStock: number
  currentMaxStock: number
  holdingCostPct: number
  unitPrice: number
}

export type ExtendedMaterial = Material & MaterialExtension

function toExtension(r: Record<string, string>): MaterialExtension {
  return {
    materialId: r.material_id,
    plant: r.plant as VziUnit,
    canonicalMaterialId: r.canonical_material_id || undefined,
    criticalityClass: (r.criticality_class || undefined) as
      | CriticalityClass
      | undefined,
    circuit: (r.circuit || undefined) as Circuit | undefined,
    planningCategory: r.planning_category as PlanningCategory,
    materialGroup: r.material_group || undefined,
    mrpType: r.mrp_type || undefined,
    isRepairable: bool(r.is_repairable),
    repairMaterialCode: r.repair_material_code || undefined,
    currentRop: num(r.current_rop),
    currentSafetyStock: num(r.current_safety_stock),
    currentMaxStock: num(r.current_max_stock),
    holdingCostPct: num(r.holding_cost_pct),
    unitPrice: num(r.unit_price),
  }
}

const EXTENSIONS: MaterialExtension[] = ROWS.map(toExtension)

export function getMaterialExtension(
  materialId: string,
  plant?: VziUnit
): MaterialExtension | undefined {
  return EXTENSIONS.find(
    (e) => e.materialId === materialId && (!plant || e.plant === plant)
  )
}

export function getExtendedMaterials(plant?: VziUnit): ExtendedMaterial[] {
  return MATERIALS.flatMap((material) => {
    const extension = getMaterialExtension(material.id, plant)
    return extension ? [{ ...material, ...extension }] : []
  })
}

export function getExtendedMaterial(
  materialId: string,
  plant: VziUnit
): ExtendedMaterial | undefined {
  const material = MATERIALS.find((m) => m.id === materialId)
  const extension = getMaterialExtension(materialId, plant)
  return material && extension ? { ...material, ...extension } : undefined
}
