"use client"

import { Fragment, useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"

import { DeclarationForm } from "@/components/repairables/declaration-form"
import { AgingCell } from "@/components/shared/aging-cell"
import { EmptyState } from "@/components/shared/empty-state"
import { ALL_FILTER, FilterBar, FilterSelect } from "@/components/shared/filter-bar"
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
import type { DeclarationStatus, FlaggedPr, VziUnit } from "@/lib/types"

const PLANTS: VziUnit[] = ["Gamsberg", "BMM"]

const DECLARATION_TONE: Record<
  DeclarationStatus,
  "default" | "success" | "warning"
> = {
  Pending: "warning",
  Complete: "success",
  "Not required": "default",
}

export function FlaggedPrQueue({ rows }: { rows: FlaggedPr[] }) {
  const [plant, setPlant] = useState<VziUnit | typeof ALL_FILTER>(ALL_FILTER)
  const [declared, setDeclared] = useState<Record<string, boolean>>({})

  const filtered = useMemo(
    () => rows.filter((r) => plant === ALL_FILTER || r.plant === plant),
    [rows, plant]
  )

  if (rows.length === 0) {
    return (
      <EmptyState message="No flagged PRs -- nothing is currently colliding with an open repair chain." />
    )
  }

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
      </FilterBar>

      {filtered.length === 0 ? (
        <EmptyState message="No flagged PRs match these filters." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PR</TableHead>
              <TableHead>Material</TableHead>
              <TableHead>Plant</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead>Flagged</TableHead>
              <TableHead>Declaration</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((row) => {
              const status = declared[row.prNumber]
                ? "Complete"
                : row.declarationStatus
              return (
                <Fragment key={row.prNumber}>
                  <TableRow>
                    <TableCell className="font-medium text-foreground">
                      {row.prNumber}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.materialId}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.plant}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-foreground">
                      {row.quantity}
                    </TableCell>
                    <TableCell>
                      <AgingCell days={row.daysFlagged} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={DECLARATION_TONE[status]}>
                        {status}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/repairables/request/${row.materialId}`}
                        className={buttonVariants({
                          variant: "outline",
                          size: "xs",
                        })}
                      >
                        Review
                      </Link>
                    </TableCell>
                  </TableRow>
                  {status === "Pending" && (
                    <TableRow>
                      <TableCell colSpan={7} className="bg-muted/30 p-3">
                        <DeclarationForm
                          materialId={row.materialId}
                          prNumber={row.prNumber}
                          onSubmit={({ confirmed, note }) => {
                            setDeclared((prev) => ({
                              ...prev,
                              [row.prNumber]: true,
                            }))
                            toast.success(
                              `Declaration captured for ${row.prNumber}`,
                              { description: confirmed ? note : undefined }
                            )
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              )
            })}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
