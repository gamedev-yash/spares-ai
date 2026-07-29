// Server-only: reads and parses src/lib/data/vzi_situation_analysis.csv once
// at module load (mirrors how Anish's data.py loads the source workbook at
// import time). This module touches Node's `fs` — import it only from Server
// Components and pass the results down as props; never import it from a
// "use client" file.
import fs from "fs"
import path from "path"

import { parseCsvRecords } from "@/lib/csv"
import type {
  FishboneCategory,
  FishboneRootCause,
  RootCauseTrendPoint,
  SituationDrillDownItem,
  SituationKpiSummary,
  Urgency,
  VziAgingBucket,
  VziUnit,
} from "@/lib/types"

const CSV_PATH = path.join(
  process.cwd(),
  "src/lib/data/vzi_situation_analysis.csv"
)

const ROWS: Record<string, string>[] = parseCsvRecords(
  fs.readFileSync(CSV_PATH, "utf-8")
)

const num = (v: string) => Number(v || 0)
const round1 = (n: number) => Math.round(n * 10) / 10

export function getAgingBuckets(): VziAgingBucket[] {
  return ROWS.filter((r) => r.section === "aging").map((r) => ({
    bucket: r.aging_bucket,
    count: num(r.count),
  }))
}

export function getRootCauses(): FishboneRootCause[] {
  return ROWS.filter((r) => r.section === "root_cause")
    .map((r) => ({
      category: r.root_cause_category as FishboneCategory,
      daysLost: num(r.days_lost),
      subCauses: r.sub_causes.split("|").filter(Boolean),
      badge: r.badge || undefined,
    }))
    .sort((a, b) => b.daysLost - a.daysLost)
}

export function getRootCauseTrend(): RootCauseTrendPoint[] {
  return ROWS.filter((r) => r.section === "trend").map((r) => ({
    month: r.month,
    category: r.root_cause_category as FishboneCategory,
    daysLost: num(r.days_lost),
  }))
}

export function getDrillDownItems(): SituationDrillDownItem[] {
  return ROWS.filter((r) => r.section === "drill_down").map((r) => ({
    id: r.pr_po_number,
    prPoNumber: r.pr_po_number,
    unit: r.unit as VziUnit,
    area: r.area,
    type: r.type as "Material" | "Service",
    category: r.category,
    valueZar: num(r.value_zar),
    agingBucket: r.aging_bucket,
    rootCauseCategory: r.root_cause_category as FishboneCategory,
    primaryCauseDetail: r.primary_cause_detail,
    stuckWithPerson: r.stuck_with_person,
    stuckWithRole: r.stuck_with_role,
    urgency: r.urgency as Urgency,
    sessionId: r.session_id || undefined,
  }))
}

export function getSituationKpiSummary(): SituationKpiSummary {
  const agingBuckets = getAgingBuckets()
  const totalOpenPrs = agingBuckets.reduce((sum, b) => sum + b.count, 0)
  const over30Index = agingBuckets.findIndex((b) => b.bucket === "30-60 days")
  const prOver30 = agingBuckets
    .slice(over30Index)
    .reduce((sum, b) => sum + b.count, 0)

  const poRows = ROWS.filter((r) => r.section === "po_detail")
  const totalOpenPos = poRows.reduce((sum, r) => sum + num(r.count), 0)
  const totalOpenPoValueZar = poRows.reduce(
    (sum, r) => sum + num(r.value_zar),
    0
  )
  const servicePoValueZar = poRows
    .filter((r) => r.type === "Service")
    .reduce((sum, r) => sum + num(r.value_zar), 0)

  return {
    totalOpenPrs,
    prOver30,
    prOver30Pct: round1((prOver30 / totalOpenPrs) * 100),
    totalOpenPos,
    totalOpenPoValueZar,
    servicePoValueZar,
    servicePct: round1((servicePoValueZar / totalOpenPoValueZar) * 100),
    topDrivers: getRootCauses().slice(0, 2),
  }
}
