import type { InitiativeManifest } from "@/lib/domain/manifest"

export const initiative8Manifest: InitiativeManifest = {
  id: "initiative-8",
  name: "Refurbishable Spares",
  description:
    "Repair-chain visibility and duplicate-procurement guarding for repairable spares",
  // Overview now lives as a tab on the global Spares Control Tower
  // (see src/components/overview/overview-tabs.tsx) instead of its own
  // route — this href is where the summary card / "open" links go.
  href: "/overview?tab=initiative-8",
  navSection: {
    title: "Refurbishable Spares",
    items: [
      {
        label: "Repair Register",
        icon: "wrench",
        href: "/refurbishable-spares/repair-register",
      },
      {
        label: "Duplicate Guard",
        icon: "copy",
        href: "/refurbishable-spares/duplicate-guard",
      },
      {
        label: "Declaration Queue",
        icon: "file-text",
        href: "/refurbishable-spares/declarations",
      },
    ],
  },
  suggestedQuestions: [
    "Which repairable spares have active repair chains?",
    "Are there any duplicate procurement attempts on repairable materials?",
    "Which condition-to-repair declarations are still pending?",
  ],
}
