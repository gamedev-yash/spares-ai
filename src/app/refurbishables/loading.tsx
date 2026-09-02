import { Skeleton } from "@/components/ui/skeleton"

export default function RefurbishablesLoading() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <div className="space-y-2">
          <Skeleton className="h-3 w-56" />
          <Skeleton className="h-7 w-80" />
          <Skeleton className="h-4 w-[30rem] max-w-full" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        {/* Repair status register: filters, tabs, ~14 rows */}
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-8 w-96 max-w-full rounded-lg" />
          <Skeleton className="h-[26rem] rounded-lg" />
        </div>
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-12">
          <Skeleton className="h-80 rounded-xl lg:col-span-7" />
          <Skeleton className="h-80 rounded-xl lg:col-span-5" />
        </div>
      </div>
    </div>
  )
}
