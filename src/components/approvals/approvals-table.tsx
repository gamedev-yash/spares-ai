"use client"

import { Fragment, useCallback, useEffect, useState } from "react"
import { Check, EllipsisVertical, ShieldCheck, TriangleAlert, X } from "lucide-react"
import { toast } from "sonner"

import { DuplicateContextAlert } from "@/components/repair/duplicate-alert"
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
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ApiError } from "@/lib/api/client"
import {
  approveApproval,
  escalateApproval,
  rejectApproval,
  searchApprovals,
  type ApprovalRecord,
} from "@/lib/api/approvals"
import { formatZAR } from "@/lib/utils"

const ALL_FILTER = "all"
const URGENCIES = ["Normal", "High", "Critical"] as const
const PAGE_SIZE = 25

const URGENCY_TONE: Record<(typeof URGENCIES)[number], "default" | "warning" | "danger"> = {
  Normal: "default",
  High: "warning",
  Critical: "danger",
}

export function ApprovalsTable() {
  const [urgency, setUrgency] = useState<(typeof URGENCIES)[number] | typeof ALL_FILTER>(ALL_FILTER)
  const [page, setPage] = useState(1)
  const [approvals, setApprovals] = useState<ApprovalRecord[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actingOn, setActingOn] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await searchApprovals({
        status: "PENDING",
        urgency: urgency === ALL_FILTER ? undefined : urgency,
        page,
        page_size: PAGE_SIZE,
      })
      setApprovals(result.items)
      setTotal(result.total)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load approvals.")
    } finally {
      setLoading(false)
    }
  }, [urgency, page])

  useEffect(() => {
    load()
  }, [load])

  async function decide(item: ApprovalRecord, action: "approved" | "rejected" | "escalated") {
    setActingOn(item.id)
    const label = item.material_description ?? item.rr_number ?? `Approval #${item.id}`
    try {
      if (action === "approved") await approveApproval(item.id)
      else if (action === "rejected") await rejectApproval(item.id)
      else await escalateApproval(item.id)

      const message = `${action[0].toUpperCase()}${action.slice(1)} — ${label}`
      if (action === "rejected") toast.error(message)
      else if (action === "escalated") toast.warning(message)
      else toast.success(message)

      setApprovals((prev) => prev.filter((a) => a.id !== item.id))
      setTotal((t) => Math.max(0, t - 1))
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Action failed.")
    } finally {
      setActingOn(null)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select
          value={urgency}
          onValueChange={(value) => {
            setUrgency((value as (typeof URGENCIES)[number] | typeof ALL_FILTER) ?? ALL_FILTER)
            setPage(1)
          }}
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

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : loading ? (
        <Skeleton className="h-80 rounded-xl" />
      ) : approvals.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No pending approvals match these filters.
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{total} pending approvals</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>RR</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Requester</TableHead>
                <TableHead>Approval type</TableHead>
                <TableHead className="text-right">Est. value</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Approver role</TableHead>
                <TableHead>Urgency</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {approvals.map((item) => (
                <Fragment key={item.id}>
                <TableRow>
                  <TableCell className="font-medium text-foreground">
                    <div>{item.rr_number ?? "-"}</div>
                    {/* Initiative 8: the duplicate flag and the declaration travel with the
                        document, so the approver decides with both in view. */}
                    {(item.duplicate_flag || item.attestation) && (
                      <div className="mt-1 flex flex-col items-start gap-1">
                        {item.duplicate_flag && (
                          <StatusBadge tone="warning">Repair in progress</StatusBadge>
                        )}
                        {item.attestation_pending ? (
                          <StatusBadge tone="danger">Declaration pending</StatusBadge>
                        ) : item.attestation?.status === "COMPLETE" ? (
                          <StatusBadge tone="success">Declared</StatusBadge>
                        ) : null}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[220px] truncate text-foreground">
                    {item.material_description ?? "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.requester_name ?? "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{item.approval_type}</TableCell>
                  <TableCell className="text-right font-medium text-foreground">
                    {item.total_value != null ? formatZAR(item.total_value) : "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(item.submitted_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{item.approver_role}</TableCell>
                  <TableCell>
                    {item.urgency ? (
                      <StatusBadge
                        tone={URGENCY_TONE[item.urgency as (typeof URGENCIES)[number]] ?? "default"}
                      >
                        {item.urgency}
                      </StatusBadge>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        size="xs"
                        variant="outline"
                        disabled={actingOn === item.id}
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
                          disabled={actingOn === item.id}
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
                  </TableCell>
                </TableRow>

                {/* Initiative 8: the approver alert -- what is already in flight, plus the
                    requisitioner's declaration, both visible at the moment of decision. */}
                {(item.duplicate_context || item.attestation) && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={9} className="pt-0">
                      <div className="flex flex-col gap-2">
                        {item.duplicate_context && (
                          <DuplicateContextAlert context={item.duplicate_context} />
                        )}
                        {item.attestation && (
                          <div className="rounded-xl border border-border bg-card p-3">
                            <div className="flex items-start gap-2">
                              <ShieldCheck
                                className={
                                  item.attestation.status === "COMPLETE"
                                    ? "mt-0.5 size-4 shrink-0 text-success"
                                    : "mt-0.5 size-4 shrink-0 text-warning"
                                }
                              />
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground">
                                  Condition-to-repair declaration
                                </p>
                                {item.attestation.status === "COMPLETE" ? (
                                  <>
                                    <p className="mt-1 text-sm text-muted-foreground italic">
                                      &ldquo;{item.attestation.statement}&rdquo;
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      Declared by {item.attestation.declared_by_name ?? "—"}
                                      {item.attestation.declared_at
                                        ? ` on ${new Date(item.attestation.declared_at).toLocaleDateString()}`
                                        : ""}
                                    </p>
                                  </>
                                ) : (
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    This requisition was raised automatically by min/max stock
                                    levels, so no declaration was made at creation. Approval is
                                    blocked until a planner completes it on the Declarations page.
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
