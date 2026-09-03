"use client"

import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"

import { AllInitiativesOverview } from "@/components/overview/all-initiatives-overview"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { InventoryOptimizationOverviewPage } from "@/features/initiative-7/pages/overview-page"
import { RefurbishableSparesOverviewPage } from "@/features/initiative-8/pages/overview-page"
import { OARUtilizationOverviewPage } from "@/features/initiative-13/pages/overview-page"

type TabId = "all" | "initiative-7" | "initiative-8" | "initiative-13"

const TABS: { id: TabId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "initiative-7", label: "Inventory Optimization" },
  { id: "initiative-8", label: "Refurbishable Spares" },
  { id: "initiative-13", label: "OAR Utilization" },
]

const PANEL_CLASS = "flex min-h-0 flex-1 flex-col"

function OverviewTabsInner() {
  const searchParams = useSearchParams()
  const requestedTab = searchParams.get("tab")
  const initialTab = TABS.some((t) => t.id === requestedTab) ? (requestedTab as TabId) : "all"
  const [tab, setTab] = useState<TabId>(initialTab)

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => setTab(v as TabId)}
      className="flex min-h-0 flex-1 flex-col gap-0"
    >
      <TabsList variant="line" className="h-auto shrink-0 gap-4 border-b border-border px-6">
        {TABS.map((t) => (
          <TabsTrigger key={t.id} value={t.id} className="px-1 py-2.5">
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="all" className={PANEL_CLASS}>
        <AllInitiativesOverview />
      </TabsContent>
      <TabsContent value="initiative-7" className={PANEL_CLASS}>
        <InventoryOptimizationOverviewPage />
      </TabsContent>
      <TabsContent value="initiative-8" className={PANEL_CLASS}>
        <RefurbishableSparesOverviewPage />
      </TabsContent>
      <TabsContent value="initiative-13" className={PANEL_CLASS}>
        <OARUtilizationOverviewPage />
      </TabsContent>
    </Tabs>
  )
}

/**
 * Every initiative's own Overview page (KPIs + charts, already built inside
 * `features/initiative-N/pages/overview-page.tsx`) renders here as a tab
 * instead of at its own route — no initiative code changes, this is purely
 * a global composition/navigation change. `?tab=initiative-7` etc. deep-links
 * a specific tab (used by the summary cards' "open" links).
 */
export function OverviewTabs() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading…</div>}>
      <OverviewTabsInner />
    </Suspense>
  )
}
