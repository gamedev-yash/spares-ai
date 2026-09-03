import type { InitiativeManifest } from "@/lib/domain/manifest"

export const initiative7Manifest: InitiativeManifest = {
  id: "initiative-7",
  name: "Inventory Optimization",
  description:
    "Criticality-aware ROP, safety-stock and max-stock recommendations",
  href: "/inventory-optimization",
  navSection: {
    title: "Inventory Optimization",
    items: [
      { label: "Overview", icon: "package", href: "/inventory-optimization" },
      {
        label: "Recommendations",
        icon: "lightbulb",
        href: "/inventory-optimization/recommendations",
      },
      {
        label: "Approval Queue",
        icon: "clipboard-check",
        href: "/inventory-optimization/approvals",
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
