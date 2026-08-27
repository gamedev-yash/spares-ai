import { UtilizationDetailView } from "@/components/utilization/utilization-detail"

export default async function UtilizationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-6xl">
        <UtilizationDetailView id={Number(id)} />
      </div>
    </div>
  )
}
