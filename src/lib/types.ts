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
  | "check-circle"
  | "layers"

export interface ChatOption {
  id: string
  icon: IconKey
  label: string
  description: string
}

export interface OptionGroupData {
  id: string
  options: ChatOption[]
  /** the suggested default (live groups) or the final answer (locked groups) */
  defaultSelectedId?: string
  /** true = already answered when the session was authored; always disabled */
  locked?: boolean
  /** historical confirmation timestamp, used only when locked */
  resolvedAt?: string
  /** if true, resolving this (via a live click) advances the workflow stepper */
  advancesWorkflow?: boolean
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

export type Urgency = "Normal" | "High" | "Critical"

/** Approvals-table-specific tier labels — business terminology for procurement execs. */
export type ApprovalMatchTier =
  | "Direct Equivalent (Usual)"
  | "Technical Equivalent"
  | "OEM Original (Same)"

export interface PendingApproval {
  id: string
  sessionId: string
  rrId: string // Request for Reservation ID, e.g. "RR-8841"
  materialId: string
  materialDescription: string
  requester: string
  matchTier: ApprovalMatchTier
  lastPurchasePrice: number // ZAR — most recent PO price, final auction savings not yet locked in
  waitingSince: string
  approver: string
  category: Category
  urgency: Urgency
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

// ---- VZI Open PR & PO Position dashboard (/dashboard) ----
// Ported from Anish's Dash app — figures are transcribed from the VZI review
// slides workbook and must not be re-derived or "corrected" here either.

export type VziUnit = "Gamsberg" | "BMM"

export interface VziPrSummaryRow {
  unit: VziUnit
  material: number
  service: number
}

export interface VziAgingBucket {
  bucket: string
  count: number
}

export interface VziOarVbRow {
  unit: VziUnit
  area: string
  oar: number
  vb: number
}

export interface VziCategoryRow {
  unit: VziUnit
  area: string
  category: string
  count: number
}

export interface VziPoDetailRow {
  unit: VziUnit
  area: string
  matCount: number
  matValue: number // ZAR millions
  svcCount: number
  svcValue: number // ZAR millions
}

export interface VziFlag {
  title: string
  body: string
}

export interface VziTotals {
  material: number
  service: number
  total: number
}

export interface VziUnitAggregate {
  matCount: number
  matValue: number
  svcCount: number
  svcValue: number
  count: number
  value: number
}

export interface VziOarVbAggregate {
  oar: number
  vb: number
  total: number
}

export interface VziCategoryPivotRow {
  category: string
  Gamsberg: number
  BMM: number
  total: number
}

export interface VziPoAreaRow extends VziPoDetailRow {
  label: string
  total: number
}

export interface VziKpiSummary {
  openPr: VziTotals
  openPo: VziTotals
  openPoValue: VziTotals // ZAR millions
  servicePct: number
  agingTotal: number
  prOver30: number
  prOver30Pct: number
  careMaintenance: VziTotals
}

// ---- Situation Analysis (Open PR/PO monitor — Initiative 9) ----

export type PrPoType = "PR" | "PO"

/** One of the 15 official stages an open PR/PO moves through, in order. */
export interface ProcessStage {
  no: number
  name: string
}

export type RootCauseCategory =
  | "Scope of Work"
  | "Vendor Payment"
  | "System / Integration"
  | "Buyer Delay"
  | "Ariba Participation"
  | "Technical Evaluation (PwC)"
  | "NFA Approval"

export interface PrPoSituation {
  id: string
  prPoNumber: string
  type: PrPoType
  buPlant: string
  materialDescription: string
  category: Category
  valueZar: number
  currentStageNo: number // 1-15, see PROCESS_STAGES
  currentStageName: string
  stuckWithPerson: string
  stuckWithRole: string
  daysStuck: number
  rootCauseCategory: RootCauseCategory
  urgency: Urgency
  /** links to an existing chat session for the "View chat" row action, when one exists */
  sessionId?: string
}

export interface StagePipelinePoint {
  stageNo: number
  stageName: string
  count: number
  valueZar: number
  /** worst single item at this stage — drives the tile's severity color */
  maxDaysStuck: number
  /** sum of daysStuck across items at this stage — drives bottleneck ranking */
  totalDaysStuck: number
}

export interface RootCauseDelayPoint {
  category: RootCauseCategory
  totalDaysLost: number
  itemCount: number
}

export interface SituationAnalysisSummary {
  totalCount: number
  totalValueZar: number
  avgDaysStuck: number
  highRiskCount: number // items with daysStuck > 10
  topBottleneckStage: ProcessStage
}
