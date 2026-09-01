import { Skeleton } from "@/components/ui/skeleton"

export default function InventoryOptimizationLoading() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <div className="space-y-2">
          <Skeleton className="h-3 w-64" />
          <Skeleton className="h-7 w-[26rem] max-w-full" />
          <Skeleton className="h-4 w-[34rem] max-w-full" />
        </div>

        {/* KPI row — 4 cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>

        {/* Workbench: filters, tab bar, table */}
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <Skeleton className="h-4 w-64" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-44" />
            <Skeleton className="h-9 w-48" />
          </div>
          <Skeleton className="h-9 w-80 max-w-full" />
          <Skeleton className="h-[26rem] rounded-lg" />
        </div>

        {/* Change proposal export — 3 batches */}
        <div className="space-y-2 rounded-xl border border-border bg-card p-4">
          <Skeleton className="h-4 w-48" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  )
}
