import { Skeleton } from "@/components/ui/skeleton"

export default function DashboardLoading() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <div className="space-y-2">
          <Skeleton className="h-3 w-64" />
          <Skeleton className="h-7 w-72" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-8 w-72 rounded-lg" />
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-12">
          <Skeleton className="h-72 rounded-xl lg:col-span-7" />
          <Skeleton className="h-72 rounded-xl lg:col-span-5" />
          <Skeleton className="h-48 rounded-xl lg:col-span-6" />
          <Skeleton className="h-48 rounded-xl lg:col-span-6" />
        </div>
      </div>
    </div>
  )
}
