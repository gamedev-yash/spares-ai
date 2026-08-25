"use client"

import { useMemo, useState } from "react"
import Link from "next/link"

import { AgingCell } from "@/components/shared/aging-cell"
import { EmptyState } from "@/components/shared/empty-state"
import { ALL_FILTER, FilterBar, FilterSelect } from "@/components/shared/filter-bar"
import { PriceDisplay } from "@/components/shared/price-display"
import { StatusBadge } from "@/components/shared/status-badge"
import { buttonVariants } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { DeclarationStatus, RepairRegisterRow, VziUnit } from "@/lib/types"
import { cn } from "@/lib/utils"

const PLANTS: VziUnit[] = ["Gamsberg", "BMM"]
const DECLARATION_STATUSES: DeclarationStatus[] = [
  "Pending",
  "Complete",
  "Not required",
]

const DECLARATION_TONE: Record<
  DeclarationStatus,
  "default" | "success" | "warning"
> = {
  Pending: "warning",
  Complete: "success",
  "Not required": "default",
}

export function RepairRegisterTable({ rows }: { rows: RepairRegisterRow[] }) {
  const [plant, setPlant] = useState<VziUnit | typeof ALL_FILTER>(ALL_FILTER)
  const [declarationStatus, setDeclarationStatus] = useState<
    DeclarationStatus | typeof ALL_FILTER
  >(ALL_FILTER)

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (plant !== ALL_FILTER && row.plant !== plant) return false
      if (
        declarationStatus !== ALL_FILTER &&
        row.declarationStatus !== declarationStatus
      )
        return false
      return true
    })
  }, [rows, plant, declarationStatus])

  return (
    <div className="flex flex-col gap-3">
      <FilterBar>
        <FilterSelect
          value={plant}
          onChange={(v) => setPlant(v as VziUnit | typeof ALL_FILTER)}
          options={PLANTS}
          allLabel="All plants"
          width="sm:w-40"
        />
        <FilterSelect
          value={declarationStatus}
          onChange={(v) =>
            setDeclarationStatus(v as DeclarationStatus | typeof ALL_FILTER)
          }
          options={DECLARATION_STATUSES}
          allLabel="All declaration statuses"
          width="sm:w-56"
        />
      </FilterBar>

      {filtered.length === 0 ? (
        <EmptyState message="No repair register rows match these filters." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Material</TableHead>
              <TableHead>Plant</TableHead>
              <TableHead className="text-right">Stock on hand</TableHead>
              <TableHead className="text-right">Reorder point</TableHead>
              <TableHead className="text-right">Under repair</TableHead>
              <TableHead>Aging</TableHead>
              <TableHead>Declaration</TableHead>
              <TableHead className="text-right">Value</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((row) => (
              <TableRow key={row.materialId}>
                <TableCell>
                  <div className="font-medium text-foreground">
                    {row.materialId}
                  </div>
                  <div className="max-w-[220px] truncate text-xs text-muted-foreground">
                    {row.description}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.plant}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <span
                    className={cn(
                      row.atOrBelowRop
                        ? "font-medium text-destructive"
                        : "text-foreground"
                    )}
                  >
                    {row.stockOnHand}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {row.reorderPoint ?? "—"}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums text-foreground">
                  {row.quantityUnderRepair}
                </TableCell>
                <TableCell>
                  <AgingCell days={row.maxDaysOpen} />
                </TableCell>
                <TableCell>
                  <StatusBadge tone={DECLARATION_TONE[row.declarationStatus]}>
                    {row.declarationStatus}
                  </StatusBadge>
                </TableCell>
                <TableCell className="text-right">
                  <PriceDisplay amount={row.valueZar} />
                </TableCell>
                <TableCell>
                  <Link
                    href={`/repairables/${row.materialId}`}
                    className={buttonVariants({
                      variant: "outline",
                      size: "xs",
                    })}
                  >
                    View chain
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
