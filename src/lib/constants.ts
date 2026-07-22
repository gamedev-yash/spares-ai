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
  type LucideIcon,
} from "lucide-react"

import type { Category, IconKey } from "@/lib/types"

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

export const QUICK_ACTIONS: {
  label: string
  icon: IconKey
  href: string
  badge?: number
}[] = [
  { label: "Search materials", icon: "search", href: "/materials" },
  { label: "Price benchmarks", icon: "chart-bar", href: "/dashboard" },
  {
    label: "Pending approvals",
    icon: "clipboard-check",
    href: "/approvals",
    badge: 4,
  },
  { label: "Audit trail", icon: "history", href: "/audit" },
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
