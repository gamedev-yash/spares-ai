"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import { loadAllSpareData } from "./data/loaders"
import type { SpareData } from "./data/types"
import { RecommendationEngine } from "./calc/recommendation"
import type { Recommendation } from "./calc/types"
import {
  APPROVAL_CHAIN,
  defaultApprovalEntry,
  type ApprovalEntry,
  type AdjustableField,
} from "./approvals"

/**
 * Initiative 7 runs entirely client-side against the static CSVs in /public/data -- it does
 * NOT call the FastAPI backend the rest of this app uses. That is deliberate: this is a
 * stakeholder mockup of the predictive-inventory tool, so every number is computed in the
 * browser from the shipped seed data (see src/lib/inventory/calc/).
 */
interface InventoryContextValue {
  data: SpareData | null
  engine: RecommendationEngine | null
  recommendations: Recommendation[]
  loading: boolean
  error: string | null
  approvals: {
    getEntry: (materialId: string) => ApprovalEntry
    getAllEntries: () => ApprovalEntry[]
    sendForApproval: (materialId: string, sentBy: string) => void
    approve: (materialId: string, by: string) => void
    adjust: (
      materialId: string,
      changes: { field: AdjustableField; recommended: number; adjusted: number }[],
      reason: string,
      by: string,
    ) => void
    reject: (materialId: string, reason: string, by: string) => void
  }
}

const InventoryContext = createContext<InventoryContextValue | undefined>(
  undefined
)

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<SpareData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [entries, setEntries] = useState<Record<string, ApprovalEntry>>({})

  useEffect(() => {
    let cancelled = false
    loadAllSpareData()
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Built once per data load, not per consumer, so every screen reads the same numbers.
  const engine = useMemo(
    () => (data ? new RecommendationEngine(data) : null),
    [data]
  )
  const recommendations = useMemo(
    () => (engine ? engine.getAllRecommendations() : []),
    [engine]
  )

  const getEntry = useCallback(
    (materialId: string) => entries[materialId] ?? defaultApprovalEntry(materialId),
    [entries]
  )
  // Only entries with real activity (sent/decided) matter for the ledger -- the vast
  // majority of materials never touch `entries` at all (still default NEEDS_REVIEW).
  const getAllEntries = useCallback(() => Object.values(entries), [entries])

  const update = useCallback(
    (materialId: string, patch: Partial<ApprovalEntry>) => {
      setEntries((prev) => {
        const current = prev[materialId] ?? defaultApprovalEntry(materialId)
        return { ...prev, [materialId]: { ...current, ...patch } }
      })
    },
    []
  )

  const sendForApproval = useCallback(
    (materialId: string, sentBy: string) => {
      setEntries((prev) => {
        const current = prev[materialId] ?? defaultApprovalEntry(materialId)
        if (current.status !== "NEEDS_REVIEW") return prev // already sent/decided -- no-op
        return {
          ...prev,
          [materialId]: { ...current, status: "IN_APPROVAL", stageIndex: 0, sentAt: new Date().toISOString(), sentBy },
        }
      })
    },
    []
  )

  // Approve signs off ONE stage of APPROVAL_CHAIN and hands the item to the next role. Each
  // sign-off is recorded against the stage and the person who made it, so the workflow panel
  // shows real per-user progress instead of assuming the whole chain approved at once. The
  // item only reaches APPROVED once every stage has signed off.
  const approve = useCallback(
    (materialId: string, by: string) => {
      setEntries((prev) => {
        const current = prev[materialId] ?? defaultApprovalEntry(materialId)
        if (current.status !== "IN_APPROVAL") return prev
        const stage = APPROVAL_CHAIN[current.stageIndex]
        if (!stage) return prev
        const now = new Date().toISOString()
        const nextIndex = current.stageIndex + 1
        const fullyApproved = nextIndex >= APPROVAL_CHAIN.length
        return {
          ...prev,
          [materialId]: {
            ...current,
            status: fullyApproved ? "APPROVED" : "IN_APPROVAL",
            stageIndex: nextIndex,
            stageApprovals: [...current.stageApprovals, { stage, by, at: now }],
            decidedBy: fullyApproved ? by : current.decidedBy,
            decidedAt: fullyApproved ? now : current.decidedAt,
          },
        }
      })
    },
    []
  )

  const reject = useCallback(
    (materialId: string, reason: string, by: string) =>
      update(materialId, { status: "REJECTED", rejectionReason: reason, decidedBy: by, decidedAt: new Date().toISOString() }),
    [update]
  )

  const adjust = useCallback(
    (
      materialId: string,
      changes: { field: AdjustableField; recommended: number; adjusted: number }[],
      reason: string,
      by: string,
    ) => {
      const now = new Date().toISOString()
      setEntries((prev) => {
        const current = prev[materialId] ?? defaultApprovalEntry(materialId)
        const records = changes.map((c) => ({ ...c, reason, by, at: now }))
        return {
          ...prev,
          [materialId]: {
            ...current,
            status: "ADJUSTED",
            adjustments: [...current.adjustments, ...records],
            decidedBy: by,
            decidedAt: now,
          },
        }
      })
    },
    []
  )

  const value = useMemo<InventoryContextValue>(
    () => ({
      data,
      engine,
      recommendations,
      loading: !data && !error,
      error,
      approvals: { getEntry, getAllEntries, sendForApproval, approve, reject, adjust },
    }),
    [data, engine, recommendations, error, getEntry, getAllEntries, sendForApproval, approve, reject, adjust]
  )

  return (
    <InventoryContext.Provider value={value}>
      {children}
    </InventoryContext.Provider>
  )
}

export function useInventory(): InventoryContextValue {
  const ctx = useContext(InventoryContext)
  if (!ctx)
    throw new Error("useInventory() must be used within an <InventoryProvider>")
  return ctx
}
