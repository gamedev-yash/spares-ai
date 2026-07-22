import Link from "next/link"

import { StatusBadge } from "@/components/shared/status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getMaterialById } from "@/lib/mock-data"
import type { ChatSession, SessionStatus } from "@/lib/types"

const STATUS_META: Record<
  SessionStatus,
  { label: string; tone: "default" | "success" | "warning" | "danger" }
> = {
  in_progress: { label: "In progress", tone: "default" },
  pending_approval: { label: "Pending approval", tone: "warning" },
  escalated: { label: "Escalated", tone: "danger" },
  completed: { label: "Completed", tone: "success" },
  new: { label: "New", tone: "default" },
}

const MONTH_INDEX: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
}

function dateSortKey(dateStr: string): number {
  const [day, mon, year] = dateStr.split(" ")
  return Number(year) * 10000 + (MONTH_INDEX[mon] ?? 0) * 100 + Number(day)
}

export function SessionsTable({ sessions }: { sessions: ChatSession[] }) {
  const sorted = [...sessions].sort(
    (a, b) => dateSortKey(b.date) - dateSortKey(a.date)
  )

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Session</TableHead>
          <TableHead>Material</TableHead>
          <TableHead>Requester</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Date</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((session) => {
          const material = getMaterialById(session.materialId)
          const status = STATUS_META[session.status]
          return (
            <TableRow key={session.id}>
              <TableCell>
                <Link
                  href={`/chat/${session.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  #{session.id}
                </Link>
              </TableCell>
              <TableCell className="max-w-[240px] truncate text-foreground">
                {material?.description ?? session.materialId}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {session.requester}
              </TableCell>
              <TableCell>
                <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {session.date}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
