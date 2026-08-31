"use client"

import type { ReactNode } from "react"
import { ChevronDown, RotateCcw, Search } from "lucide-react"
import { COLORS, colorMap, type ColorTone } from "@/lib/inventory/ui/colors"

// Small, mostly-inline-styled UI primitives ported 1:1 from the approved mockup
// (Initiative_7_Mockup_Preview.jsx) so the visual language matches exactly. Kept as inline
// styles (not Tailwind classes) to stay a faithful port and because every value threads
// through the --i7-* CSS custom properties in theme.css for light/dark support.

export function Badge({ children, color = "primary" }: { children: ReactNode; color?: ColorTone }) {
  const c = colorMap[color] || colorMap.primary
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 12,
        fontSize: 11,
        fontWeight: 600,
        background: c.bg,
        color: c.text,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  )
}

export function KPICard({
  label,
  value,
  sub,
  color = COLORS.primary,
  active,
  onClick,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  color?: string
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        minWidth: 150,
        textAlign: "left",
        background: active ? colorMap.primary.bg : COLORS.card,
        borderRadius: 10,
        padding: "14px 18px",
        border: `1px solid ${active ? COLORS.primary : COLORS.border}`,
        cursor: onClick ? "pointer" : "default",
        font: "inherit",
      }}
    >
      <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 4 }}>{sub}</div>}
    </button>
  )
}

export function Select({
  label,
  value,
  onChange,
  options,
  labelFor = (o: string) => o,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: string[]
  labelFor?: (o: string) => string
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 5 }}>{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          padding: "7px 8px",
          borderRadius: 6,
          border: `1px solid ${value !== "All" ? COLORS.primary : COLORS.border}`,
          background: value !== "All" ? COLORS.primaryLight : COLORS.card,
          color: COLORS.text,
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        <option value="All">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {labelFor(o)}
          </option>
        ))}
      </select>
    </div>
  )
}

export interface PillOption {
  value: string
  label: string
}

export function PillSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: PillOption[] }) {
  return (
    <div style={{ position: "relative" }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          appearance: "none",
          padding: "7px 26px 7px 12px",
          borderRadius: 7,
          border: `1px solid ${COLORS.border}`,
          background: COLORS.card,
          color: COLORS.text,
          fontSize: 12.5,
          cursor: "pointer",
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown size={12} style={{ position: "absolute", right: 9, top: 10, color: COLORS.textMuted, pointerEvents: "none" }} />
    </div>
  )
}

export function Panel({ title, children, style }: { title: ReactNode; children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ flex: 1, minWidth: 260, background: COLORS.card, borderRadius: 10, border: `1px solid ${COLORS.border}`, padding: 16, ...style }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  )
}

export function Chip({ children, highlighted }: { children: ReactNode; highlighted?: boolean }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "6px 12px",
        borderRadius: 16,
        fontSize: 12.5,
        fontWeight: 600,
        background: highlighted ? COLORS.primaryLight : COLORS.chipBg,
        color: highlighted ? COLORS.primary : COLORS.text,
      }}
    >
      {children}
    </span>
  )
}

export function SectionTitle({ icon: Icon, children }: { icon: React.ComponentType<{ size?: number; color?: string }>; children: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
      <Icon size={16} color={COLORS.textMuted} />
      <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>{children}</span>
    </div>
  )
}

export function KPIChip({ label, value, tone = "neutral" }: { label: string; value: ReactNode; tone?: "neutral" | "warning" | "danger" }) {
  const tones = {
    neutral: { bg: COLORS.card, border: COLORS.border, text: COLORS.text, valueColor: COLORS.text },
    warning: { bg: COLORS.warningLight, border: COLORS.warningBorder, text: COLORS.warning, valueColor: COLORS.warning },
    danger: { bg: COLORS.coralLight, border: COLORS.coralBorder, text: COLORS.coral, valueColor: COLORS.coral },
  }
  const t = tones[tone]
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 16px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.bg }}>
      <span style={{ fontSize: 12.5, color: t.text, fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 15, fontWeight: 800, color: t.valueColor }}>{value}</span>
    </div>
  )
}

export function ClearFiltersButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "7px 14px",
        borderRadius: 7,
        border: `1px solid ${COLORS.border}`,
        background: COLORS.card,
        color: disabled ? COLORS.textLight : COLORS.textMuted,
        fontSize: 12.5,
        fontWeight: 600,
        cursor: disabled ? "default" : "pointer",
      }}
    >
      <RotateCcw size={12} /> Clear filters
    </button>
  )
}

export function SearchBox({
  value,
  onChange,
  placeholder,
  maxWidth = 340,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  maxWidth?: number
}) {
  return (
    <div style={{ position: "relative", marginBottom: 12, maxWidth }}>
      <Search size={13} style={{ position: "absolute", left: 10, top: 10, color: COLORS.textLight }} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%",
          padding: "8px 10px 8px 28px",
          borderRadius: 7,
          border: `1px solid ${COLORS.border}`,
          background: COLORS.card,
          color: COLORS.text,
          fontSize: 13,
          boxSizing: "border-box",
        }}
      />
    </div>
  )
}
