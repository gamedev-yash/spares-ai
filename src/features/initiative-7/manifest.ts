import type { InitiativeManifest } from "@/lib/domain/manifest"

export const initiative7Manifest: InitiativeManifest = {
  id: "initiative-7",
  name: "Inventory Optimization",
  description:
    "Criticality-aware ROP, safety-stock and max-stock recommendations",
  // Overview now lives as a tab on the global Spares Control Tower
  // (see src/components/overview/overview-tabs.tsx) instead of its own
  // route — this href is where the summary card / "open" links go.
  href: "/overview?tab=initiative-7",
  navSection: {
    title: "Inventory Optimization",
    items: [
      // The Control Tower carries a summary tab for this initiative; this
      // route is the KPI/chart dashboard for watching portfolio health.
      { label: "Monitoring", icon: "package", href: "/inventory-optimization" },
      {
        label: "Recommendations",
        icon: "lightbulb",
        href: "/inventory-optimization/recommendations",
      },
      // Approvals moved into the global Action Center — its Inventory
      // Optimization tab renders this initiative's own ApprovalsWorkspace.
      {
        label: "Pipeline",
        icon: "gauge",
        href: "/inventory-optimization/pipeline",
      },
    ],
  },
  suggestedQuestions: [
    "Why is the recommended ROP for this material higher?",
    "Which materials are at stockout risk this month?",
    "Show excess inventory candidates I could release working capital from.",
  ],
}
