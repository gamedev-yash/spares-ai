"use client"

import { useState } from "react"
import { X } from "lucide-react"

import type { Recommendation } from "@/lib/inventory/calc/types"
import { ADJUSTABLE_FIELD_LABELS, type AdjustableField } from "@/lib/inventory/approvals"
import { COLORS } from "@/lib/inventory/ui/colors"

interface FieldRow {
  field: AdjustableField
  recommended: number
}

/**
 * The Adjust flow never silently overwrites a recommendation -- it always opens this
 * modal, requires a reason, and records both the original recommended value and the
 * approver's chosen value (see AdjustmentRecord in lib/inventory/approvals.ts), which is
 * what later renders as the audit-trail line: "AI recommended 32 -> {who} changed
 * Reorder Point to 20 -- Reason: {reason}".
 */
export function AdjustModal({
  rec,
  onCancel,
  onSubmit,
}: {
  rec: Recommendation
  onCancel: () => void
  onSubmit: (changes: { field: AdjustableField; recommended: number; adjusted: number }[], reason: string) => void
}) {
  const fields: FieldRow[] = [
    { field: "SafetyStock", recommended: rec.current.recommendedSafetyStock },
    { field: "ROP", recommended: rec.current.recommendedROP },
    { field: "MaxStock", recommended: rec.current.recommendedMaxStockOptionA },
  ]
  const [values, setValues] = useState<Record<AdjustableField, string>>({
    SafetyStock: String(fields[0].recommended),
    ROP: String(fields[1].recommended),
    MaxStock: String(fields[2].recommended),
  })
  const [reason, setReason] = useState("")

  const changes = fields
    .map((f) => ({ field: f.field, recommended: f.recommended, adjusted: Number(values[f.field]) }))
    .filter((c) => Number.isFinite(c.adjusted) && c.adjusted !== c.recommended)

  const canSubmit = reason.trim().length > 0 && changes.length > 0

  return (
    <div onClick={onCancel} style={{ position: "fixed", inset: 0, background: COLORS.overlay, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 440, maxWidth: "100%", background: COLORS.card, borderRadius: 16, boxShadow: `0 24px 64px ${COLORS.shadow}`, padding: "24px 28px" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: COLORS.text }}>Adjust Recommendation</span>
          <button onClick={onCancel} style={{ border: "none", background: "none", cursor: "pointer", color: COLORS.textMuted, padding: 4 }}>
            <X size={18} />
          </button>
        </div>
        <p style={{ fontSize: 12.5, color: COLORS.textMuted, margin: "0 0 18px" }}>
          {rec.materialCode} -- change any value(s) that need overriding; leave the rest as recommended.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 16 }}>
          {fields.map((f) => (
            <div key={f.field}>
              <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>{ADJUSTABLE_FIELD_LABELS[f.field]}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10.5, color: COLORS.textLight, textTransform: "uppercase", letterSpacing: 0.3 }}>Recommended</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.textMuted }}>{f.recommended}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10.5, color: COLORS.textLight, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 3 }}>New value</div>
                  <input
                    type="number"
                    value={values[f.field]}
                    onChange={(e) => setValues((v) => ({ ...v, [f.field]: e.target.value }))}
                    style={{ width: "100%", padding: "7px 9px", borderRadius: 7, border: `1px solid ${COLORS.border}`, fontSize: 14, fontWeight: 700, color: COLORS.text, boxSizing: "border-box" }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.text, marginBottom: 5 }}>Reason (required)</div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="e.g. Supplier lead time is actually lower than the estimate"
            style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 13, resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            onClick={onCancel}
            style={{ padding: "9px 18px", borderRadius: 8, border: `1px solid ${COLORS.border}`, background: COLORS.card, color: COLORS.text, fontWeight: 600, fontSize: 13, cursor: "pointer" }}
          >
            Cancel
          </button>
          <button
            onClick={() => canSubmit && onSubmit(changes, reason.trim())}
            disabled={!canSubmit}
            style={{
              padding: "9px 18px",
              borderRadius: 8,
              border: "none",
              background: COLORS.accent,
              color: "#fff",
              fontWeight: 700,
              fontSize: 13,
              cursor: canSubmit ? "pointer" : "default",
              opacity: canSubmit ? 1 : 0.45,
            }}
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  )
}
