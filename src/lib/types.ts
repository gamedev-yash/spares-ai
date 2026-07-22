// Domain types for the Spares AI mockup. All data is mock/local — see mock-data.ts.

export type Category = "Flotation" | "Conveyance" | "Milling" | "Instrumentation"

export type LifecycleStatus = "Active" | "EOL" | "Obsolete"

export interface Material {
  id: string // material code, format 500-XXXXX
  description: string
  manufacturer: string
  manufacturerPartNo: string
  specs: Record<string, string>
  category: Category
  lifecycleStatus: LifecycleStatus
  lastPoPrice: number // ZAR
  lastPoDate: string // pre-formatted "DD MMM YYYY"
  lastVendor: string
  stockLevel: number
  leadTimeDays: number
}

export interface Supplier {
  id: string
  name: string
  region: string
  categoriesServed: Category[]
  rating: number // 1-5
  onTimeDeliveryPct: number
  avgLeadTimeDays: number
  certifications: string[]
}

export type MatchTier =
  | "Direct equivalent"
  | "Technical equivalent"
  | "Functional alternative"

export interface SpecComparisonItem {
  spec: string
  original: string
  alternate: string
  match: boolean
}

export interface AlternateRecommendation {
  id: string
  materialId: string
  matchTier: MatchTier
  matchConfidence: number // 75-99
  partNumber: string
  manufacturer: string
  supplierId: string
  price: number
  moq: number
  leadTimeDays: number
  specComparison: SpecComparisonItem[]
  marketBenchmark: { low: number; high: number }
}

// ---- Chat domain ----

export type MessageRole = "user" | "ai"

/** Key into the ICONS registry in constants.ts */
export type IconKey =
  | "cpu"
  | "message-circle"
  | "search"
  | "chart-bar"
  | "clipboard-check"
  | "history"
  | "droplet"
  | "arrows-right-left"
  | "wrench"
  | "gauge"
  | "settings"
  | "help"
  | "copy"
  | "sliders"
  | "lightbulb"
  | "send"
  | "eye"
  | "file-text"
  | "check"
  | "info"
  | "trending-down"
  | "trending-up"
  | "mail"
  | "clock"
  | "alert-triangle"
  | "ellipsis-vertical"

export interface ChatOption {
  id: string
  icon: IconKey
  label: string
  description: string
}

export interface OptionGroupData {
  id: string
  options: ChatOption[]
  defaultSelectedId?: string
}

export interface ActionOptionsData {
  id: string
  actions: ChatOption[]
  /** id of the action styled with a permanent success accent, e.g. "proceed" */
  accentId?: string
  /** set when this action was already taken earlier in the session's history */
  resolvedActionId?: string
}

export interface ComparisonSide {
  label: string
  supplierName: string
  partNumber: string
  price: number
  meta: string
  savingsPct?: number
}

export interface ComparisonCardData {
  id: string
  heading: string
  current: ComparisonSide
  alternate: ComparisonSide
  benchmark: { low: number; high: number; note: string }
}

export interface ChatMessage {
  id: string
  role: MessageRole
  timestamp: string // pre-formatted "10:23 AM"
  authorLabel: string // "You" | "Spares AI"
  text?: string // supports **bold** lite markdown
  comparison?: ComparisonCardData
  options?: OptionGroupData
  actions?: ActionOptionsData
  footerNote?: string
}

export type WorkflowStepStatus = "done" | "active" | "pending"

export interface WorkflowStepData {
  id: string
  label: string
  status: WorkflowStepStatus
  meta?: string
  /** visual tone override for the active step, e.g. escalated/overdue */
  tone?: "default" | "warning" | "danger"
}

export type EmailStatus = "sent" | "pending" | "escalated"

export interface EmailNotificationData {
  id: string
  status: EmailStatus
  text: string
  time: string
}

export interface TraceTag {
  label: string
  kind: "cat" | "tier" | "status"
}

export interface TraceInfo {
  tags: TraceTag[]
  material: string
  equipment: string
  requester: string
  specMatch: string
  selectionsDone: number
  selectionsTotal: number
}

export type SessionStatus =
  | "in_progress"
  | "pending_approval"
  | "escalated"
  | "completed"
  | "new"

export interface NavBadge {
  type: "count" | "alert"
  value?: number
}

export interface ChatSession {
  id: string // e.g. "SPR-2847"
  title: string // full chat header title
  navLabel: string // short sidebar label
  navSubtitle: string
  navBadge?: NavBadge
  category: Category
  status: SessionStatus
  materialId: string
  requester: string
  date: string // pre-formatted "DD MMM YYYY" — when the session was opened
  messages: ChatMessage[]
  workflow: WorkflowStepData[]
  emails: EmailNotificationData[]
  trace: TraceInfo
}

// ---- Secondary pages ----

export interface PendingApproval {
  id: string
  sessionId: string
  materialId: string
  materialDescription: string
  requester: string
  matchTier: MatchTier
  savingsPct: number
  waitingSince: string
  approver: string
  category: Category
  urgency: "Normal" | "High" | "Critical"
}

export type ApprovalDecision = "approved" | "rejected" | "escalated"

export interface AuditEntry {
  id: string
  timestamp: string
  sessionId: string
  action: string
  actor: "User" | "AI" | "System"
  material: string
  detail: string
  fullDetail: string
}

export interface DashboardSummary {
  activeSessions: number
  alternatesFoundThisMonth: number
  costSavingsZAR: number
  pendingApprovals: number
}

export interface SavingsTrendPoint {
  month: string
  savings: number
}

export interface CategoryBreakdownPoint {
  category: Category
  value: number
}
