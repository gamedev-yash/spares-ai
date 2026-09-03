"use client"

import { useMemo, useState } from "react"
import { Check, EllipsisVertical, TriangleAlert, X } from "lucide-react"
import { toast } from "sonner"

import { MaterialIdentity } from "@/components/shared/material-identity"
import { RiskBadge } from "@/components/shared/risk-badge"
import { StatusBadge } from "@/components/shared/status-badge"
import { FilterBar } from "@/components/shared/filter-bar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useMaterial360 } from "@/lib/material-360-context"
import { getPlantById } from "@/lib/shared-data/plants"
import { APPROVAL_ROLES, type ApprovalRole, approverName } from "@/features/initiative-7/data/approval-chain"
import type { Recommendation } from "@/features/initiative-7/types/inventory"

const ALL = "all"

type QuickDecision = "approved" | "rejected" | "escalated"

const DECISION_LABEL: Record<QuickDecision, string> = {
  approved: "Approved",
  rejected: "Rejected",
  escalated: "Escalated",
}

const DECISION_TONE: Record<QuickDecision, "success" | "danger" | "warning"> = {
  approved: "success",
  rejected: "danger",
  escalated: "warning",
}

function pendingRole(rec: Recommendation): ApprovalRole | null {
  const idx = rec.workflow.findIndex((s) => s.status === "active")
  return idx === -1 ? null : APPROVAL_ROLES[idx]
}

export function ApprovalsQueueTable({ recommendations }: { recommendations: Recommendation[] }) {
  const { openMaterial360 } = useMaterial360()
  const [decisions, setDecisions] = useState<Record<string, QuickDecision>>({})
  const [role, setRole] = useState<string>(ALL)

  const rows = useMemo(
    () =>
      recommendations
        .map((r) => ({ rec: r, role: pendingRole(r) }))
        .filter((row): row is { rec: Recommendation; role: ApprovalRole } => row.role !== null),
    [recommendations]
  )

  const filtered = useMemo(
    () => (role === ALL ? rows : rows.filter((r) => r.role === role)),
    [rows, role]
  )

  function decide(rec: Recommendation, decision: QuickDecision) {
    setDecisions((prev) => ({ ...prev, [rec.id]: decision }))
    const message = `${DECISION_LABEL[decision]} — ${rec.material.description} (${rec.id})`
    if (decision === "rejected") toast.error(message)
    else if (decision === "escalated") toast.warning(message)
    else toast.success(message)
  }

  return (
    <div className="flex flex-col gap-4">
      <FilterBar>
        <Select value={role} onValueChange={(v) => setRole(v ?? ALL)}>
          <SelectTrigger className="h-8 w-full sm:w-56">
            <SelectValue placeholder="Approver role">
              {(v: string) => (v === ALL ? "All approver roles" : v)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All approver roles</SelectItem>
            {APPROVAL_ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nothing awaiting a decision right now.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Plant</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Awaiting</TableHead>
                <TableHead>Approver</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(({ rec, role: pending }) => {
                const decision = decisions[rec.id]
                return (
                  <TableRow key={rec.id}>
                    <TableCell>
                      <MaterialIdentity material={rec.material} onOpen={openMaterial360} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {getPlantById(rec.plantId)?.name ?? rec.plantId}
                    </TableCell>
                    <TableCell>
                      <RiskBadge level={rec.risk} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{rec.status}</TableCell>
                    <TableCell className="text-muted-foreground">{pending}</TableCell>
                    <TableCell className="text-muted-foreground">{approverName(pending)}</TableCell>
                    <TableCell>
                      {decision ? (
                        <StatusBadge tone={DECISION_TONE[decision]}>{DECISION_LABEL[decision]}</StatusBadge>
                      ) : (
                        <div className="flex items-center gap-1">
                          <Button
                            size="xs"
                            variant="outline"
                            className="border-success/40 text-success hover:bg-success/10"
                            onClick={() => decide(rec, "approved")}
                          >
                            <Check className="size-3.5" />
                            Approve
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              className="flex size-6 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground outline-none hover:bg-muted hover:text-foreground"
                              aria-label="More actions"
                            >
                              <EllipsisVertical className="size-3.5" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem variant="destructive" onClick={() => decide(rec, "rejected")}>
                                <X className="size-3.5" />
                                Reject
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => decide(rec, "escalated")}>
                                <TriangleAlert className="size-3.5 text-warning" />
                                Escalate
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        Quick decisions here are a mockup convenience and update this view only — open a recommendation for the full
        approval workflow and audit trail.
      </p>
    </div>
  )
}
