import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
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
import type { PlatformAlert } from "@/lib/types"

const SEVERITY_TONE: Record<
  PlatformAlert["severity"],
  "default" | "warning" | "danger"
> = {
  info: "default",
  warning: "warning",
  critical: "danger",
}

export function AlertList({
  alerts,
  onAction,
}: {
  alerts: PlatformAlert[]
  onAction?: (alert: PlatformAlert) => void
}) {
  if (alerts.length === 0) {
    return (
      <EmptyState message="No open alerts across Repairables, Inventory, or Utilisation." />
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Severity</TableHead>
          <TableHead>Initiative</TableHead>
          <TableHead>Alert</TableHead>
          <TableHead>Raised</TableHead>
          <TableHead>Days Open</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {alerts.map((alert) => (
          <TableRow key={alert.id}>
            <TableCell>
              <StatusBadge tone={SEVERITY_TONE[alert.severity]}>
                {alert.severity}
              </StatusBadge>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {alert.initiative}
            </TableCell>
            <TableCell className="max-w-[320px]">
              <div className="font-medium text-foreground">{alert.title}</div>
              <div className="truncate text-xs text-muted-foreground">
                {alert.detail}
              </div>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {alert.raisedAt}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {alert.daysOpen !== undefined ? `${alert.daysOpen}d` : "—"}
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <Link
                  href={alert.href}
                  className={buttonVariants({ variant: "outline", size: "xs" })}
                >
                  View
                  <ArrowRight className="size-3.5" />
                </Link>
                {onAction && (
                  <button
                    type="button"
                    onClick={() => onAction(alert)}
                    className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                  >
                    Acknowledge
                  </button>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
