import type { ReactNode } from "react"

export function EmptyState({ message }: { message: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
      {message}
    </div>
  )
}
