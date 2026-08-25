import type { ReactNode } from "react"
import { ChevronDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function CapturePanel({
  open,
  onOpenChange,
  title,
  children,
  onSubmit,
  submitLabel,
  disabled = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: ReactNode
  onSubmit: () => void
  submitLabel: string
  disabled?: boolean
}) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium text-foreground"
      >
        {title}
        <ChevronDown
          className={cn(
            "size-4 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <div className="flex flex-col gap-3 border-t border-border p-4">
          {children}
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              disabled={disabled}
              onClick={onSubmit}
            >
              {submitLabel}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
