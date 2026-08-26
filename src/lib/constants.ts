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
  ShieldCheck,
  type LucideIcon,
} from "lucide-react"

import type { Category, IconKey, MaterialCategory } from "@/lib/types"

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
  "shield-check": ShieldCheck,
}

export const CATEGORIES: { label: Category; icon: IconKey }[] = [
  { label: "Flotation", icon: "droplet" },
  { label: "Conveyance", icon: "arrows-right-left" },
  { label: "Milling", icon: "wrench" },
  { label: "Instrumentation", icon: "gauge" },
]

/** Curated subset shown as sidebar quick-links, so the list stays short like the original
 * 4-category nav did -- the materials page filter fetches the full, live category list from
 * GET /api/materials/categories instead of a static one. */
export const MATERIAL_CATEGORIES: { label: MaterialCategory; icon: IconKey }[] = [
  { label: "Bearings", icon: "settings" },
  { label: "Pumps", icon: "droplet" },
  { label: "Valves", icon: "sliders" },
  { label: "Motors", icon: "gauge" },
  { label: "Electrical Spares", icon: "cpu" },
  { label: "Mechanical Seals", icon: "check-circle" },
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
  // Initiative 8 -- the refurbishment loop, made visible next to stock.
  { label: "Repair register", icon: "wrench", href: "/repair-register" },
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
    // badge is overridden with a live count from the backend -- see Sidebar.
  },
  {
    label: "Declarations",
    icon: "shield-check",
    href: "/declarations",
    // badge is overridden with the live pending-declaration count -- see Sidebar.
  },
  { label: "Audit trail", icon: "history", href: "/audit" },
  { label: "Notifications", icon: "mail", href: "/notifications" },
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
