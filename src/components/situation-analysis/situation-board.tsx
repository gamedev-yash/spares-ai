"use client"

import { useState } from "react"

import { DrilldownTable } from "@/components/situation-analysis/drilldown-table"
import { StagePipeline } from "@/components/situation-analysis/stage-pipeline"
import type { PrPoSituation, StagePipelinePoint } from "@/lib/types"

export function SituationBoard({
  items,
  stagePipeline,
}: {
  items: PrPoSituation[]
  stagePipeline: StagePipelinePoint[]
}) {
  const [selectedStage, setSelectedStage] = useState<number | null>(null)
  const activeStage = stagePipeline.find((s) => s.stageNo === selectedStage)

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-medium text-foreground">
          Process pipeline — where items are stuck
        </h2>
        <p className="text-xs text-muted-foreground">
          Click a stage to filter the table below. Stages are colored by the
          longest single item waiting there.
        </p>
        <div className="mt-3">
          <StagePipeline
            stages={stagePipeline}
            selectedStage={selectedStage}
            onSelectStage={(stageNo) =>
              setSelectedStage((prev) => (prev === stageNo ? null : stageNo))
            }
          />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-medium text-foreground">
          Open PR/PO drill-down — where &amp; who it&apos;s stuck with
        </h2>
        <DrilldownTable
          items={items}
          stageFilter={
            activeStage
              ? { no: activeStage.stageNo, name: activeStage.stageName }
              : null
          }
          onClearStageFilter={() => setSelectedStage(null)}
        />
      </div>
    </>
  )
}
