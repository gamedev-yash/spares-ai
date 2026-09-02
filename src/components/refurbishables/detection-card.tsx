import { ArrowRight } from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type {
  CodingCandidate,
  DetectionSummary,
} from "@/lib/refurbishables-data"
import { formatCount } from "@/lib/utils"

export function DetectionCard({
  summary,
  candidates,
}: {
  summary: DetectionSummary
  candidates: CodingCandidate[]
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div className="rounded-lg border border-border p-3">
          <div className="text-2xl font-semibold text-foreground">
            {formatCount(summary.eightySeriesDetected)}
          </div>
          <div className="mt-0.5 text-xs leading-snug text-muted-foreground">
            80-series materials detected in the material master
          </div>
        </div>
        <div className="rounded-lg border border-warning/40 bg-warning/5 p-3">
          <div className="text-2xl font-semibold text-warning">
            {formatCount(summary.codingCandidatesFlagged)}
          </div>
          <div className="mt-0.5 text-xs leading-snug text-muted-foreground">
            repair-pattern materials <em>not</em> coded 80-series — coding
            candidates
          </div>
        </div>
      </div>

      <div>
        <div className="mb-1 text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
          Top coding candidates
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Material</TableHead>
              <TableHead className="text-right">Repairs (24m)</TableHead>
              <TableHead>Suggested action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {candidates.map((candidate) => (
              <TableRow key={candidate.materialCode}>
                <TableCell>
                  <div className="font-mono text-[13px] font-medium text-foreground">
                    {candidate.materialCode}
                  </div>
                  <div className="max-w-[170px] truncate text-[11px] text-muted-foreground">
                    {candidate.description} · {candidate.plant}
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums text-foreground">
                  {candidate.repairCount24m}
                </TableCell>
                <TableCell className="whitespace-normal">
                  <span className="flex items-start gap-1.5 text-[13px] leading-snug text-muted-foreground">
                    <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-primary" />
                    {candidate.suggestedAction}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
