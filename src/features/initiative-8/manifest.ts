import type { InitiativeManifest } from "@/lib/domain/manifest"

export const initiative8Manifest: InitiativeManifest = {
  id: "initiative-8",
  name: "Refurbishable Spares",
  description:
    "Repair-chain visibility and duplicate-procurement guarding for repairable spares",
  href: "/refurbishable-spares",
  navSection: {
    title: "Refurbishable Spares",
    items: [
      { label: "Overview", icon: "rotate-ccw", href: "/refurbishable-spares" },
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
