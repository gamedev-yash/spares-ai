import { Skeleton } from "@/components/ui/skeleton"

export default function SituationAnalysisLoading() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-96 max-w-full" />
          <Skeleton className="h-4 w-[28rem] max-w-full" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        {/* Section B hero view: 2 charts + 7 cards */}
        <div className="space-y-4 rounded-xl border border-border bg-card p-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Skeleton className="h-72 rounded-lg" />
            <Skeleton className="h-72 rounded-lg" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        </div>
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    </div>
  )
}
