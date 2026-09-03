import type { InitiativeManifest } from "@/lib/domain/manifest"

export const initiative13Manifest: InitiativeManifest = {
  id: "initiative-13",
  name: "OAR Utilization",
  description:
    "End-to-end tracking of OAR spares demand from reservation through utilization",
  href: "/oar-utilization",
  navSection: {
    title: "OAR Utilization",
    items: [
      { label: "Overview", icon: "activity", href: "/oar-utilization" },
      {
        label: "Utilization Ledger",
        icon: "layers",
        href: "/oar-utilization/ledger",
      },
      {
        label: "Aging Exceptions",
        icon: "clock",
        href: "/oar-utilization/aging-exceptions",
      },
      {
        label: "Redeployment",
        icon: "arrows-right-left",
        href: "/oar-utilization/redeployment",
      },
      {
        label: "Reclassification",
        icon: "sliders",
        href: "/oar-utilization/reclassification",
      },
    ],
  },
  suggestedQuestions: [
    "Show OAR materials past their planned consumption date.",
    "Which OAR materials are candidates for stocked-material reclassification?",
    "Is there unused stock elsewhere I could redeploy instead of buying new?",
  ],
}
