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

import type {
  Category,
  IconKey,
  ProcessStage,
  RootCauseCategory,
} from "@/lib/types"

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

/** The 15 official PR/PO process stages tracked by Situation Analysis, in order. */
export const PROCESS_STAGES: ProcessStage[] = [
  { no: 1, name: "Maintenance Order" },
  { no: 2, name: "Component" },
  { no: 3, name: "Request for Reservation (RR)" },
  { no: 4, name: "DOA (Dept. Table)" },
  { no: 5, name: "Reservation" },
  { no: 6, name: "Standard MRP" },
  { no: 7, name: "PR Creation" },
  { no: 8, name: "PR (SAP ECC)" },
  { no: 9, name: "RFQ" },
  { no: 10, name: "Ariba" },
  { no: 11, name: "Auction" },
  { no: 12, name: "Technical Evaluation (PwC)" },
  { no: 13, name: "NFA" },
  { no: 14, name: "Ariba Manual" },
  { no: 15, name: "PO / Contract" },
]

export const ROOT_CAUSE_CATEGORIES: RootCauseCategory[] = [
  "Scope of Work",
  "Vendor Payment",
  "System / Integration",
  "Buyer Delay",
  "Ariba Participation",
  "Technical Evaluation (PwC)",
  "NFA Approval",
]

export const BU_PLANTS = [
  "Black Mountain Mine",
  "Gamsberg Mine",
  "Skorpion Zinc",
] as const
