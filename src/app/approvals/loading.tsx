import { Skeleton } from "@/components/ui/skeleton"

export default function ApprovalsLoading() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Skeleton className="h-9 w-44" />
          <Skeleton className="h-9 w-52" />
          <Skeleton className="h-9 w-40" />
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    </div>
  )
}
