import {
  Cpu,
  MessageCircle,
  Search,
  ChartBar,
  ClipboardCheck,
  History,
  Droplet,
  ArrowLeftRight,
  Wrench,
  Gauge,
  Settings,
  CircleQuestionMark,
  Copy,
  SlidersHorizontal,
  Lightbulb,
  Send,
  Eye,
  FileText,
  Check,
  Info,
  TrendingDown,
  TrendingUp,
  Mail,
  Clock,
  TriangleAlert,
  EllipsisVertical,
  CircleCheck,
  Layers,
  Package,
  RotateCcw,
  Activity,
  LayoutDashboard,
  Inbox,
  type LucideIcon,
} from "lucide-react"

import type { Category, IconKey } from "@/lib/types"
import { initiative7Manifest } from "@/features/initiative-7/manifest"
import { initiative8Manifest } from "@/features/initiative-8/manifest"
import { initiative13Manifest } from "@/features/initiative-13/manifest"

export const ICONS: Record<IconKey, LucideIcon> = {
  cpu: Cpu,
  "message-circle": MessageCircle,
  search: Search,
  "chart-bar": ChartBar,
  "clipboard-check": ClipboardCheck,
  history: History,
  droplet: Droplet,
  "arrows-right-left": ArrowLeftRight,
  wrench: Wrench,
  gauge: Gauge,
  settings: Settings,
  help: CircleQuestionMark,
  copy: Copy,
  sliders: SlidersHorizontal,
  lightbulb: Lightbulb,
  send: Send,
  eye: Eye,
  "file-text": FileText,
  check: Check,
  info: Info,
  "trending-down": TrendingDown,
  "trending-up": TrendingUp,
  mail: Mail,
  clock: Clock,
  "alert-triangle": TriangleAlert,
  "ellipsis-vertical": EllipsisVertical,
  "check-circle": CircleCheck,
  layers: Layers,
  package: Package,
  "rotate-ccw": RotateCcw,
  activity: Activity,
  "layout-dashboard": LayoutDashboard,
  inbox: Inbox,
}

export const CATEGORIES: { label: Category; icon: IconKey }[] = [
  { label: "Flotation", icon: "droplet" },
  { label: "Conveyance", icon: "arrows-right-left" },
  { label: "Milling", icon: "wrench" },
  { label: "Instrumentation", icon: "gauge" },
]

/**
 * Fixed categorical identity color per plant area — validated for CVD/contrast
 * (dataviz skill, 4-slot categorical palette). Assigned by entity, never by
 * rank, so a filtered view can't repaint the survivors.
 */
export const CATEGORY_COLORS: Record<Category, string> = {
  Milling: "var(--chart-1)",
  Conveyance: "var(--chart-2)",
  Flotation: "var(--chart-3)",
  Instrumentation: "var(--chart-4)",
}

/** Sidebar nav sections owned by Initiative 7/8/13 — sourced directly from
 * each initiative's manifest so this file never needs another edit once a
 * manifest's page list is final. */
export const INITIATIVE_NAV_SECTIONS = [
  initiative7Manifest.navSection,
  initiative8Manifest.navSection,
  initiative13Manifest.navSection,
]

export const QUICK_ACTIONS: {
  label: string
  icon: IconKey
  href: string
  badge?: number
}[] = [
  {
    label: "Spares Control Tower",
    icon: "layout-dashboard",
    href: "/overview",
  },
  { label: "Search materials", icon: "search", href: "/materials" },
  // Pending items across every module surface in the Action Center, which
  // links straight into each module's own approval page.
  { label: "Action Center", icon: "inbox", href: "/action-center" },
  { label: "Audit trail", icon: "history", href: "/audit" },
]

/** AI Assistant context selector — swaps the chat's suggested-question chips.
 * Deterministic, UI-only: no change to the chat engine or message model. */
export const AI_ASSISTANT_CONTEXTS: {
  id: "all" | "initiative-7" | "initiative-8" | "initiative-13"
  label: string
  suggestedQuestions: string[]
}[] = [
  {
    id: "all",
    label: "All Spares",
    suggestedQuestions: [
      "Is this material OAR or non-OAR?",
      "Why is the recommended ROP for this material higher?",
      "Which repairable spares have active repair chains?",
      "Show OAR materials past their planned consumption date.",
    ],
  },
  {
    id: "initiative-7",
    label: initiative7Manifest.name,
    suggestedQuestions: initiative7Manifest.suggestedQuestions,
  },
  {
    id: "initiative-8",
    label: initiative8Manifest.name,
    suggestedQuestions: initiative8Manifest.suggestedQuestions,
  },
  {
    id: "initiative-13",
    label: initiative13Manifest.name,
    suggestedQuestions: initiative13Manifest.suggestedQuestions,
  },
]

export const DEFAULT_SESSION_ID = "SPR-2847"

/** Hardcoded blank chat opened by the sidebar "New session" button (mock). */
export const NEW_SESSION_ID = "SPR-2900"

export const WORKFLOW_STEP_LABELS = [
  "Material identified",
  "Application confirmed",
  "Alternate selection",
  "Procurement approval",
  "Engineering sign-off",
  "PO generation",
] as const
