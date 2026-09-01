"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Plus,
  Boxes,
  ListChecks,
  ClipboardCheck,
  Workflow,
  AlertTriangle,
  ShieldCheck,
  FileBarChart,
} from "lucide-react"

import { LogoutButton } from "@/components/shared/logout-button"
import { ThemeToggle } from "@/components/shared/theme-toggle"
import { searchApprovals } from "@/lib/api/approvals"
import { listChatSessions, type ChatSessionSummary } from "@/lib/api/chat"
import {
  MATERIAL_CATEGORIES,
  DASHBOARD_LINKS,
  ICONS,
  QUICK_ACTIONS,
} from "@/lib/constants"
import { cn } from "@/lib/utils"

/** Initiative 7 -- predictive inventory & safety stock optimization (client-side mockup,
 * see src/lib/inventory/). Kept as a self-contained icon set rather than the ICONS registry
 * since these routes/icons are specific to this one nav section. */
const INITIATIVE7_LINKS: {
  label: string
  href: string
  icon: typeof Boxes
  exact?: boolean
}[] = [
  { label: "Overview", href: "/inventory", icon: Boxes, exact: true },
  { label: "My Actions / Approvals", href: "/inventory/approvals", icon: ClipboardCheck },
  { label: "Pipeline", href: "/inventory/pipeline", icon: Workflow },
  { label: "Recommendations", href: "/inventory/recommendations", icon: ListChecks },
  { label: "Exceptions", href: "/inventory/exceptions", icon: AlertTriangle },
  { label: "Policies", href: "/inventory/policies", icon: ShieldCheck },
  { label: "Reports", href: "/inventory/reports", icon: FileBarChart },
]

function NavSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="py-1">
      <div className="px-4 pt-3 pb-1 text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
        {title}
      </div>
      <div className="flex flex-col">{children}</div>
    </div>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const [pendingApprovals, setPendingApprovals] = useState<number | null>(null)
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([])

  useEffect(() => {
    if (pathname === "/login") return
    searchApprovals({ status: "PENDING", page_size: 1 })
      .then((result) => setPendingApprovals(result.total))
      .catch(() => setPendingApprovals(null))
    listChatSessions()
      .then(setSessions)
      .catch(() => setSessions([]))
  }, [pathname])

  if (pathname === "/login") return null

  const CpuIcon = ICONS["cpu"]
  const MessageIcon = ICONS["message-circle"]
  const newSessionHref = "/chat/assistant"
  const isOnNewSession = pathname?.startsWith(newSessionHref) ?? false

  return (
    <aside className="flex w-[240px] shrink-0 flex-col border-r border-border bg-card">
      <div className="shrink-0 border-b border-border p-4">
        <h3 className="flex items-center gap-1.5 text-[15px] font-medium text-foreground">
          <CpuIcon className="size-[18px]" />
          Spares AI
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Vedanta procurement platform
        </p>
      </div>

      {/* Only this middle section scrolls -- the header above and the theme
          toggle/logout footer below stay pinned in view regardless of how many
          nav sections/sessions are listed. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="px-2 pt-3 pb-1">
        <Link
          href={newSessionHref}
          className={cn(
            "flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-[13px] transition-colors",
            isOnNewSession
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Plus className="size-4 shrink-0" />
          <span className="font-medium">New session</span>
        </Link>
      </div>

      <NavSection title="Active sessions">
        {sessions.map((session) => {
          const href = `/chat/assistant/${session.id}`
          const isActive = pathname === href
          return (
            <Link
              key={session.id}
              href={href}
              className={cn(
                "mx-2 my-0.5 flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              <MessageIcon className="size-4 shrink-0" />
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block truncate font-medium",
                    isActive ? "text-accent-foreground" : "text-foreground"
                  )}
                >
                  {session.title}
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {session.status}
                </span>
              </span>
            </Link>
          )
        })}
      </NavSection>

      <NavSection title="Dashboards">
        {DASHBOARD_LINKS.map((link) => {
          const Icon = ICONS[link.icon]
          const isActive = pathname === link.href
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "mx-2 my-0.5 flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="size-4 shrink-0" />
              {link.label}
            </Link>
          )
        })}
      </NavSection>

      <NavSection title="Initiative 7">
        {INITIATIVE7_LINKS.map((link) => {
          const Icon = link.icon
          const isActive = link.exact ? pathname === link.href : pathname?.startsWith(link.href)
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "mx-2 my-0.5 flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] transition-colors",
                isActive
                  ? "bg-[var(--i7-primary-light)] text-[var(--i7-primary)]"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="size-4 shrink-0" />
              {link.label}
            </Link>
          )
        })}
      </NavSection>

      <NavSection title="Quick actions">
        {QUICK_ACTIONS.map((action) => {
          const Icon = ICONS[action.icon]
          const isActive = pathname === action.href
          return (
            <Link
              key={action.href}
              href={action.href}
              className={cn(
                "mx-2 my-0.5 flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              <Icon className="size-4 shrink-0" />
              {action.label}
              {(() => {
                const badge = action.href === "/approvals" ? pendingApprovals : action.badge
                return (
                  badge != null &&
                  badge > 0 && (
                    <span className="ml-auto shrink-0 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[11px] font-medium text-destructive">
                      {badge}
                    </span>
                  )
                )
              })()}
            </Link>
          )
        })}
      </NavSection>

      <NavSection title="Categories">
        {MATERIAL_CATEGORIES.map((category) => {
          const Icon = ICONS[category.icon]
          return (
            <Link
              key={category.label}
              href={`/materials?category=${encodeURIComponent(category.label)}`}
              className="mx-2 my-0.5 flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Icon className="size-4 shrink-0" />
              {category.label}
            </Link>
          )
        })}
      </NavSection>
      </div>

      <div className="shrink-0 border-t border-border py-1">
        <ThemeToggle />
        <LogoutButton />
      </div>
    </aside>
  )
}
