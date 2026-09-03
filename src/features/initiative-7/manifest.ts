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
      {
        label: "Recommendations",
        icon: "lightbulb",
        href: "/inventory-optimization/recommendations",
      },
      {
        label: "Monitoring",
        icon: "gauge",
        href: "/inventory-optimization/monitoring",
      },
    ],
  },
  suggestedQuestions: [
    "Why is the recommended ROP for this material higher?",
    "Which materials are at stockout risk this month?",
    "Show excess inventory candidates I could release working capital from.",
  ],
}
