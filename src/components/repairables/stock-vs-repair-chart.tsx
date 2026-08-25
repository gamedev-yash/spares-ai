import { TwoSeriesBarChart } from "@/components/dashboard/two-series-bar-chart"

export function StockVsRepairChart({
  data,
}: {
  data: { material: string; onHand: number; underRepair: number }[]
}) {
  return (
    <TwoSeriesBarChart
      data={data}
      categoryKey="material"
      seriesA={{ key: "onHand", name: "On hand", color: "var(--success)" }}
      seriesB={{
        key: "underRepair",
        name: "Under repair",
        color: "var(--warning)",
      }}
      stacked
      height={180}
    />
  )
}
