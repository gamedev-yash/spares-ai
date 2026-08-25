"use client"

import { Download } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ConditionAttestation } from "@/lib/types"
import { downloadCsv } from "@/lib/utils"

const DECISION_LABEL: Record<ConditionAttestation["decision"], string> = {
  proceeded: "Proceeded",
  waited: "Waited",
  cancelled: "Cancelled",
}

export function AttestationLog({
  entries,
}: {
  entries: ConditionAttestation[]
}) {
  function handleExport() {
    downloadCsv(
      "spares-ai-repair-attestations.csv",
      [
        "PR Number",
        "Material",
        "Plant",
        "Declared By",
        "Declared At",
        "Decision",
        "Note",
      ],
      entries.map((e) => [
        e.prNumber,
        e.materialId,
        e.plant,
        e.declaredBy,
        e.declaredAt,
        DECISION_LABEL[e.decision],
        e.note ?? "",
      ])
    )
    toast.success(`Exported ${entries.length} attestations to CSV`)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="size-3.5" />
          Export to CSV
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>PR</TableHead>
            <TableHead>Material</TableHead>
            <TableHead>Plant</TableHead>
            <TableHead>Declared by</TableHead>
            <TableHead>Declared at</TableHead>
            <TableHead>Decision</TableHead>
            <TableHead>Context at declaration</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell className="font-medium text-foreground">
                {entry.prNumber}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {entry.materialId}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {entry.plant}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {entry.declaredBy}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {entry.declaredAt}
              </TableCell>
              <TableCell className="text-foreground">
                {DECISION_LABEL[entry.decision]}
              </TableCell>
              <TableCell className="max-w-[280px] truncate text-muted-foreground">
                {entry.chainContextSnapshot}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
