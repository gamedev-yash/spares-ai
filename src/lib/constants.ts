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
  "check-circle": CircleCheck,
  layers: Layers,
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

/**
 * Seven-step "good -> critical" aging gradient, mixed from our own status
 * tokens (not hardcoded hex) so it stays correct in dark mode too.
 */
export const VZI_AGING_COLORS = [
  "var(--success)",
  "color-mix(in oklch, var(--success) 66%, var(--warning) 34%)",
  "color-mix(in oklch, var(--success) 33%, var(--warning) 67%)",
  "var(--warning)",
  "color-mix(in oklch, var(--warning) 66%, var(--destructive) 34%)",
  "color-mix(in oklch, var(--warning) 33%, var(--destructive) 67%)",
  "var(--destructive)",
] as const

export const DASHBOARD_LINKS: { label: string; icon: IconKey; href: string }[] = [
  { label: "Overview", icon: "chart-bar", href: "/dashboard" },
  {
    label: "Situation Analysis",
    icon: "layers",
    href: "/dashboard/situation-analysis",
  },
]

export const QUICK_ACTIONS: {
  label: string
  icon: IconKey
  href: string
  badge?: number
}[] = [
  { label: "Search materials", icon: "search", href: "/materials" },
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

// ---- Initiative navigation (Repairables / Inventory / Utilisation / Platform) ----

export type NavItem = { label: string; icon: IconKey; href: string; badge?: number }
export type NavGroup = { title: string; items: NavItem[] }

export const INITIATIVE_NAV: NavGroup[] = [
  {
    title: "Repairables",
    items: [
      { label: "Repair register", icon: "wrench", href: "/repairables" },
      {
        label: "Flagged PRs",
        icon: "alert-triangle",
        href: "/repairables/flagged",
      },
      { label: "Attestation log", icon: "history", href: "/repairables/audit" },
    ],
  },
  {
    title: "Inventory",
    items: [
      {
        label: "Recommendations",
        icon: "lightbulb",
        href: "/inventory/recommendations",
      },
      {
        label: "Criticality policy",
        icon: "file-text",
        href: "/inventory/policy",
      },
      {
        label: "Exceptions",
        icon: "alert-triangle",
        href: "/inventory/exceptions",
      },
      { label: "Monitoring", icon: "chart-bar", href: "/inventory/monitoring" },
    ],
  },
  {
    title: "Utilisation",
    items: [
      { label: "Ledger", icon: "clipboard-check", href: "/utilisation/ledger" },
      {
        label: "Exceptions",
        icon: "alert-triangle",
        href: "/utilisation/exceptions",
      },
      { label: "Dashboards", icon: "layers", href: "/utilisation/dashboards" },
      { label: "Event log", icon: "history", href: "/utilisation/audit" },
    ],
  },
  {
    title: "Platform",
    items: [{ label: "Alert centre", icon: "alert-triangle", href: "/alerts" }],
  },
]
