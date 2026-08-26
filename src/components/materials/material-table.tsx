"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"

import { PriceDisplay } from "@/components/shared/price-display"
import { StatusBadge } from "@/components/shared/status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { LifecycleStatus, Material } from "@/lib/types"

const LIFECYCLE_TONE: Record<LifecycleStatus, "success" | "warning" | "danger"> = {
  Active: "success",
  EOL: "warning",
  Obsolete: "danger",
}

export function MaterialTable({ materials }: { materials: Material[] }) {
  const router = useRouter()

  if (materials.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No materials match these filters.
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Material code</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Manufacturer part no.</TableHead>
          <TableHead>Last vendor</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Lifecycle</TableHead>
          <TableHead className="text-right">Last PO price</TableHead>
          <TableHead className="text-right">Stock</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {materials.map((material) => (
          <TableRow
            key={material.id}
            className="cursor-pointer"
            onClick={() => router.push(`/chat/new/${material.material_code}`)}
          >
            <TableCell>
              <Link
                href={`/chat/new/${material.material_code}`}
                onClick={(e) => e.stopPropagation()}
                className="font-medium text-primary hover:underline"
              >
                {material.material_code}
              </Link>
            </TableCell>
            <TableCell className="max-w-[220px]">
              <div className="truncate text-foreground">{material.description}</div>
              {/* Initiative 8: repairability comes from the 80-series code convention, so the
                  population is visible on the code itself as well as here. */}
              {material.is_repairable && (
                <StatusBadge tone="warning" className="mt-1">
                  Repairable
                </StatusBadge>
              )}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {material.manufacturer_part_no}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {material.last_vendor}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {material.material_group}
            </TableCell>
            <TableCell>
              <StatusBadge tone={LIFECYCLE_TONE[material.lifecycle_status]}>
                {material.lifecycle_status}
              </StatusBadge>
            </TableCell>
            <TableCell className="text-right">
              <PriceDisplay amount={material.last_po_price ?? 0} />
            </TableCell>
            <TableCell className="text-right text-muted-foreground">
              {material.stock_level}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
