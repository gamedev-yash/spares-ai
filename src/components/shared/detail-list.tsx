import type { ReactNode } from "react"

export function DetailList({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <div className="flex flex-col gap-1.5 text-xs">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-start justify-between gap-3">
          <span className="text-muted-foreground">{label}</span>
          <span className="text-right font-medium text-foreground">
            {value}
          </span>
        </div>
      ))}
    </div>
  )
}
