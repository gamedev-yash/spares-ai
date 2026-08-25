import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { VziDashboard } from "@/lib/api/vzi"
import { formatCount } from "@/lib/utils"

function decimal2(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const SUBTOTAL_ROW = "bg-muted/40 font-semibold [&_td]:text-foreground"
const GRAND_ROW =
  "bg-accent/50 font-semibold [&_td]:text-foreground border-t-2 border-t-primary/40"

export function PrSummaryTable({ dashboard }: { dashboard: VziDashboard }) {
  const totals = dashboard.kpiSummary.openPr
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Unit</TableHead>
          <TableHead className="text-right">Material</TableHead>
          <TableHead className="text-right">Service</TableHead>
          <TableHead className="text-right">Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {dashboard.prSummary.map((r) => (
          <TableRow key={r.unit}>
            <TableCell className="text-foreground">{r.unit}</TableCell>
            <TableCell className="text-right text-muted-foreground">
              {formatCount(r.material)}
            </TableCell>
            <TableCell className="text-right text-muted-foreground">
              {formatCount(r.service)}
            </TableCell>
            <TableCell className="text-right text-muted-foreground">
              {formatCount(r.material + r.service)}
            </TableCell>
          </TableRow>
        ))}
        <TableRow className={GRAND_ROW}>
          <TableCell>Total</TableCell>
          <TableCell className="text-right">{formatCount(totals.material)}</TableCell>
          <TableCell className="text-right">{formatCount(totals.service)}</TableCell>
          <TableCell className="text-right">{formatCount(totals.total)}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}

export function PoSummaryTable({ dashboard }: { dashboard: VziDashboard }) {
  const totals = dashboard.kpiSummary.openPo
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Unit</TableHead>
          <TableHead className="text-right">Material</TableHead>
          <TableHead className="text-right">Service</TableHead>
          <TableHead className="text-right">Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {dashboard.poSummary.map((r) => (
          <TableRow key={r.unit}>
            <TableCell className="text-foreground">{r.unit}</TableCell>
            <TableCell className="text-right text-muted-foreground">
              {formatCount(r.material)}
            </TableCell>
            <TableCell className="text-right text-muted-foreground">
              {formatCount(r.service)}
            </TableCell>
            <TableCell className="text-right text-muted-foreground">
              {formatCount(r.material + r.service)}
            </TableCell>
          </TableRow>
        ))}
        <TableRow className={GRAND_ROW}>
          <TableCell>Total</TableCell>
          <TableCell className="text-right">{formatCount(totals.material)}</TableCell>
          <TableCell className="text-right">{formatCount(totals.service)}</TableCell>
          <TableCell className="text-right">{formatCount(totals.total)}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}

export function AgingTable({ dashboard }: { dashboard: VziDashboard }) {
  const total = dashboard.kpiSummary.agingTotal
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Aging bucket</TableHead>
          <TableHead className="text-right">Count</TableHead>
          <TableHead className="text-right">% of {formatCount(total)}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {dashboard.aging.map((a) => (
          <TableRow key={a.bucket}>
            <TableCell className="text-foreground">{a.bucket}</TableCell>
            <TableCell className="text-right text-muted-foreground">
              {formatCount(a.count)}
            </TableCell>
            <TableCell className="text-right text-muted-foreground">
              {((a.count / total) * 100).toFixed(1)}%
            </TableCell>
          </TableRow>
        ))}
        <TableRow className={GRAND_ROW}>
          <TableCell>Total</TableCell>
          <TableCell className="text-right">{formatCount(total)}</TableCell>
          <TableCell className="text-right">100.0%</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}

export function CategoriesTable({ dashboard }: { dashboard: VziDashboard }) {
  const rows = dashboard.categoryPivot
  const totalG = rows.reduce((sum, r) => sum + r.Gamsberg, 0)
  const totalB = rows.reduce((sum, r) => sum + r.BMM, 0)
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Category</TableHead>
          <TableHead className="text-right">Gamsberg</TableHead>
          <TableHead className="text-right">BMM</TableHead>
          <TableHead className="text-right">Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.category}>
            <TableCell className="text-foreground">{r.category}</TableCell>
            <TableCell className="text-right text-muted-foreground">
              {formatCount(r.Gamsberg)}
            </TableCell>
            <TableCell className="text-right text-muted-foreground">
              {formatCount(r.BMM)}
            </TableCell>
            <TableCell className="text-right text-muted-foreground">
              {formatCount(r.total)}
            </TableCell>
          </TableRow>
        ))}
        <TableRow className={GRAND_ROW}>
          <TableCell>Total</TableCell>
          <TableCell className="text-right">{formatCount(totalG)}</TableCell>
          <TableCell className="text-right">{formatCount(totalB)}</TableCell>
          <TableCell className="text-right">{formatCount(totalG + totalB)}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}

export function OarVbTable({ dashboard }: { dashboard: VziDashboard }) {
  const byUnit = dashboard.oarVbByUnit
  const grandOar = dashboard.oarVb.reduce((sum, r) => sum + r.oar, 0)
  const grandVb = dashboard.oarVb.reduce((sum, r) => sum + r.vb, 0)

  const rows: { label: string; oar: number; vb: number; cls?: string }[] = []
  let currentUnit: string | null = null
  for (const r of dashboard.oarVb) {
    if (currentUnit !== null && r.unit !== currentUnit) {
      const s = byUnit[currentUnit]
      rows.push({ label: `${currentUnit} subtotal`, oar: s.oar, vb: s.vb, cls: SUBTOTAL_ROW })
    }
    rows.push({ label: `${r.unit} — ${r.area}`, oar: r.oar, vb: r.vb })
    currentUnit = r.unit
  }
  if (currentUnit !== null) {
    const s = byUnit[currentUnit]
    rows.push({ label: `${currentUnit} subtotal`, oar: s.oar, vb: s.vb, cls: SUBTOTAL_ROW })
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Unit · area</TableHead>
          <TableHead className="text-right">OAR</TableHead>
          <TableHead className="text-right">VB</TableHead>
          <TableHead className="text-right">Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.label} className={r.cls}>
            <TableCell className={r.cls ? undefined : "text-foreground"}>{r.label}</TableCell>
            <TableCell className={r.cls ? "text-right" : "text-right text-muted-foreground"}>
              {formatCount(r.oar)}
            </TableCell>
            <TableCell className={r.cls ? "text-right" : "text-right text-muted-foreground"}>
              {formatCount(r.vb)}
            </TableCell>
            <TableCell className={r.cls ? "text-right" : "text-right text-muted-foreground"}>
              {formatCount(r.oar + r.vb)}
            </TableCell>
          </TableRow>
        ))}
        <TableRow className={GRAND_ROW}>
          <TableCell>Grand total</TableCell>
          <TableCell className="text-right">{formatCount(grandOar)}</TableCell>
          <TableCell className="text-right">{formatCount(grandVb)}</TableCell>
          <TableCell className="text-right">{formatCount(grandOar + grandVb)}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}

export function PoDetailTable({ dashboard }: { dashboard: VziDashboard }) {
  const byUnit = dashboard.poByUnit
  const pot = dashboard.kpiSummary.openPo
  const pv = dashboard.poDetail.reduce(
    (acc, p) => ({ material: acc.material + p.matValue, service: acc.service + p.svcValue }),
    { material: 0, service: 0 }
  )

  const rows: {
    label: string
    matCount: number
    matValue: number
    svcCount: number
    svcValue: number
    cls?: string
  }[] = []
  let currentUnit: string | null = null
  for (const p of dashboard.poDetail) {
    if (currentUnit !== null && p.unit !== currentUnit) {
      const s = byUnit[currentUnit]
      rows.push({
        label: `${currentUnit} subtotal`,
        matCount: s.matCount,
        matValue: s.matValue,
        svcCount: s.svcCount,
        svcValue: s.svcValue,
        cls: SUBTOTAL_ROW,
      })
    }
    rows.push({
      label: `${p.unit} — ${p.area}`,
      matCount: p.matCount,
      matValue: p.matValue,
      svcCount: p.svcCount,
      svcValue: p.svcValue,
    })
    currentUnit = p.unit
  }
  if (currentUnit !== null) {
    const s = byUnit[currentUnit]
    rows.push({
      label: `${currentUnit} subtotal`,
      matCount: s.matCount,
      matValue: s.matValue,
      svcCount: s.svcCount,
      svcValue: s.svcValue,
      cls: SUBTOTAL_ROW,
    })
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Unit · area</TableHead>
          <TableHead className="text-right">Material POs</TableHead>
          <TableHead className="text-right">Material value</TableHead>
          <TableHead className="text-right">Service POs</TableHead>
          <TableHead className="text-right">Service value</TableHead>
          <TableHead className="text-right">Total POs</TableHead>
          <TableHead className="text-right">Total value</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.label} className={r.cls}>
            <TableCell className={r.cls ? undefined : "text-foreground"}>{r.label}</TableCell>
            <TableCell className={r.cls ? "text-right" : "text-right text-muted-foreground"}>
              {formatCount(r.matCount)}
            </TableCell>
            <TableCell className={r.cls ? "text-right" : "text-right text-muted-foreground"}>
              {decimal2(r.matValue)}
            </TableCell>
            <TableCell className={r.cls ? "text-right" : "text-right text-muted-foreground"}>
              {formatCount(r.svcCount)}
            </TableCell>
            <TableCell className={r.cls ? "text-right" : "text-right text-muted-foreground"}>
              {decimal2(r.svcValue)}
            </TableCell>
            <TableCell className={r.cls ? "text-right" : "text-right text-muted-foreground"}>
              {formatCount(r.matCount + r.svcCount)}
            </TableCell>
            <TableCell className={r.cls ? "text-right" : "text-right text-muted-foreground"}>
              {decimal2(r.matValue + r.svcValue)}
            </TableCell>
          </TableRow>
        ))}
        <TableRow className={GRAND_ROW}>
          <TableCell>Grand total</TableCell>
          <TableCell className="text-right">{formatCount(pot.material)}</TableCell>
          <TableCell className="text-right">{decimal2(pv.material)}</TableCell>
          <TableCell className="text-right">{formatCount(pot.service)}</TableCell>
          <TableCell className="text-right">{decimal2(pv.service)}</TableCell>
          <TableCell className="text-right">{formatCount(pot.total)}</TableCell>
          <TableCell className="text-right">{decimal2(pv.material + pv.service)}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}
