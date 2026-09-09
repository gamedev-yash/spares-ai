"use client"

import { Fragment, useState } from "react"
import { ChevronDown, ChevronRight, Download } from "lucide-react"
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
import type { AuditEntry } from "@/lib/types"
import { downloadCsv } from "@/lib/utils"

export function AuditLog({ entries }: { entries: AuditEntry[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  function handleExport() {
    downloadCsv(
      "spares-ai-audit-log.csv",
      ["Timestamp", "Session ID", "Action", "Actor", "Material", "Detail"],
      entries.map((e) => [
        e.timestamp,
        e.sessionId,
        e.action,
        e.actor,
        e.material,
        e.fullDetail,
      ])
    )
    toast.success(`Exported ${entries.length} audit entries to CSV`)
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
            <TableHead className="w-8" />
            <TableHead>Timestamp</TableHead>
            <TableHead>Session ID</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Actor</TableHead>
            <TableHead>Material</TableHead>
            <TableHead>Detail</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => {
            const isExpanded = expandedId === entry.id
            return (
              <Fragment key={entry.id}>
                <TableRow
                  className="cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  aria-expanded={isExpanded}
                >
                  <TableCell>
                    {isExpanded ? (
                      <ChevronDown className="size-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="size-4 text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {entry.timestamp}
                  </TableCell>
                  <TableCell className="font-medium text-foreground">
                    #{entry.sessionId}
                  </TableCell>
                  <TableCell className="text-foreground">
                    {entry.action}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {entry.actor}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {entry.material}
                  </TableCell>
                  <TableCell className="max-w-[320px] truncate text-muted-foreground">
                    {entry.detail}
                  </TableCell>
                </TableRow>
                {isExpanded && (
                  <TableRow>
                    <TableCell />
                    <TableCell
                      colSpan={6}
                      className="bg-muted/30 py-3 text-xs whitespace-normal text-foreground"
                    >
                      {entry.fullDetail}
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
