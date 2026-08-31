import { COLORS } from "@/lib/inventory/ui/colors"

export function LoadingState() {
  return (
    <div style={{ minHeight: 0, flex: "1 1 auto", overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ flex: 1, minWidth: 150, height: 84, borderRadius: 10, background: COLORS.card, border: `1px solid ${COLORS.border}` }} />
        ))}
      </div>
      <div style={{ height: 320, borderRadius: 10, background: COLORS.card, border: `1px solid ${COLORS.border}` }} />
    </div>
  )
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div
      style={{
        minHeight: 0,
        flex: "1 1 auto",
        overflowY: "auto",
        padding: 20,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        textAlign: "center",
      }}
    >
      <p style={{ fontWeight: 600, color: COLORS.coral, margin: 0 }}>Failed to load inventory data</p>
      <p style={{ maxWidth: 380, fontSize: 13, color: COLORS.textMuted, margin: 0 }}>{message}</p>
    </div>
  )
}
