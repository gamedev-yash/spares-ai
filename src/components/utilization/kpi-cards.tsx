export interface KpiCardSpec {
  label: string
  figure: string
  sub?: string
  tone?: "default" | "danger" | "success"
}

export function KpiCardRow({ cards }: { cards: KpiCardSpec[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-medium text-muted-foreground">{card.label}</div>
          <div
            className={
              "mt-1.5 text-2xl font-semibold " +
              (card.tone === "danger" ? "text-destructive" : card.tone === "success" ? "text-success" : "text-foreground")
            }
          >
            {card.figure}
          </div>
          {card.sub && <div className="mt-1 text-xs leading-snug text-muted-foreground">{card.sub}</div>}
        </div>
      ))}
    </div>
  )
}
