import type { Metadata } from "next"

import { MaterialsExplorer } from "@/components/materials/materials-explorer"
import { MATERIALS } from "@/lib/mock-data"

export const metadata: Metadata = {
  title: "Materials — Spares AI",
}

export default function MaterialsPage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Material search
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Click a row to start a new alternate-sourcing session for that
            material.
          </p>
        </div>
        <MaterialsExplorer materials={MATERIALS} />
      </div>
    </div>
  )
}
