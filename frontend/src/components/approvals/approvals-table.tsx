"use client"

import { useMemo, useState } from "react"
import { Check, EllipsisVertical, TriangleAlert, X } from "lucide-react"
import { toast } from "sonner"

import { StatusBadge } from "@/components/shared/status-badge"
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
import { CATEGORIES } from "@/lib/constants"
import { formatZAR } from "@/lib/utils"
import type {
  ApprovalDecision,
  ApprovalMatchTier,
  Category,
  PendingApproval,
} from "@/lib/types"

const ALL_FILTER = "all"
const URGENCIES = ["Normal", "High", "Critical"] as const
const MATCH_TIERS: ApprovalMatchTier[] = [
  "Direct Equivalent (Usual)",
  "Technical Equivalent",
  "OEM Original (Same)",
]

const URGENCY_TONE: Record<
  (typeof URGENCIES)[number],
  "default" | "warning" | "danger"
> = {
  Normal: "default",
  High: "warning",
  Critical: "danger",
}

const DECISION_LABEL: Record<ApprovalDecision, string> = {
  approved: "Approved",
  rejected: "Rejected",
  escalated: "Escalated",
}

const DECISION_TONE: Record<ApprovalDecision, "success" | "danger" | "warning"> = {
  approved: "success",
  rejected: "danger",
  escalated: "warning",
}

export function ApprovalsTable({ approvals }: { approvals: PendingApproval[] }) {
  const [decisions, setDecisions] = useState<Record<string, ApprovalDecision>>({})
  const [category, setCategory] = useState<Category | typeof ALL_FILTER>(
    ALL_FILTER
  )
  const [matchTier, setMatchTier] = useState<
    ApprovalMatchTier | typeof ALL_FILTER
  >(ALL_FILTER)
  const [urgency, setUrgency] = useState<
    (typeof URGENCIES)[number] | typeof ALL_FILTER
  >(ALL_FILTER)

  const filtered = useMemo(() => {
    return approvals.filter((a) => {
      if (category !== ALL_FILTER && a.category !== category) return false
      if (matchTier !== ALL_FILTER && a.matchTier !== matchTier) return false
      if (urgency !== ALL_FILTER && a.urgency !== urgency) return false
      return true
    })
  }, [approvals, category, matchTier, urgency])

  function decide(item: PendingApproval, decision: ApprovalDecision) {
    setDecisions((prev) => ({ ...prev, [item.id]: decision }))
    const message = `${DECISION_LABEL[decision]} — ${item.materialDescription} (#${item.sessionId})`
    if (decision === "rejected") toast.error(message)
    else if (decision === "escalated") toast.warning(message)
    else toast.success(message)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select
          value={category}
          onValueChange={(value) => setCategory(value as Category | typeof ALL_FILTER)}
        >
          <SelectTrigger className="h-9 w-full sm:w-44">
            <SelectValue placeholder="Category">
              {(value: string) => (value === ALL_FILTER ? "All categories" : value)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All categories</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.label} value={c.label}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={matchTier}
          onValueChange={(value) =>
            setMatchTier(value as ApprovalMatchTier | typeof ALL_FILTER)
          }
        >
          <SelectTrigger className="h-9 w-full sm:w-52">
            <SelectValue placeholder="Match tier">
              {(value: string) => (value === ALL_FILTER ? "All match tiers" : value)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All match tiers</SelectItem>
            {MATCH_TIERS.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={urgency}
          onValueChange={(value) =>
            setUrgency(value as (typeof URGENCIES)[number] | typeof ALL_FILTER)
          }
        >
          <SelectTrigger className="h-9 w-full sm:w-40">
            <SelectValue placeholder="Urgency">
              {(value: string) => (value === ALL_FILTER ? "All urgencies" : value)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All urgencies</SelectItem>
            {URGENCIES.map((u) => (
              <SelectItem key={u} value={u}>
                {u}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No approvals match these filters.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Session ID</TableHead>
              <TableHead>RR ID</TableHead>
              <TableHead>Material</TableHead>
              <TableHead>Requester</TableHead>
              <TableHead>Match Tier</TableHead>
              <TableHead className="text-right">
                <abbr
                  title="Last Purchase Price (PP)"
                  className="cursor-help underline decoration-dotted underline-offset-4"
                >
                  LPP
                </abbr>
              </TableHead>
              <TableHead>Waiting Since</TableHead>
              <TableHead>Approver</TableHead>
              <TableHead>Urgency</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((item) => {
              const decision = decisions[item.id]
              return (
                <TableRow key={item.id}>
                  <TableCell className="font-medium text-foreground">
                    #{item.sessionId}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.rrId}
                  </TableCell>
                  <TableCell className="max-w-[220px] truncate text-foreground">
                    {item.materialDescription}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.requester}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.matchTier}
                  </TableCell>
                  <TableCell className="text-right font-medium text-foreground">
                    {formatZAR(item.lastPurchasePrice)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.waitingSince}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.approver}
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={URGENCY_TONE[item.urgency]}>
                      {item.urgency}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>
                    {decision ? (
                      <StatusBadge tone={DECISION_TONE[decision]}>
                        {DECISION_LABEL[decision]}
                      </StatusBadge>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Button
                          size="xs"
                          variant="outline"
                          className="border-success/40 text-success hover:bg-success/10"
                          onClick={() => decide(item, "approved")}
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
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => decide(item, "rejected")}
                            >
                              <X className="size-3.5" />
                              Reject
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => decide(item, "escalated")}>
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
      )}
    </div>
  )
}
