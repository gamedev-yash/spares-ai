import { ICONS } from "@/lib/constants"
import type { IconKey } from "@/lib/types"
import { cn } from "@/lib/utils"

type OptionCardTone = "default" | "success"

export function OptionCard({
  icon,
  label,
  description,
  selected = false,
  onSelect,
  showRadio = true,
  tone = "default",
  disabled = false,
}: {
  icon: IconKey
  label: string
  description: string
  selected?: boolean
  onSelect?: () => void
  showRadio?: boolean
  tone?: OptionCardTone
  disabled?: boolean
}) {
  const Icon = ICONS[icon]
  const isSuccess = tone === "success"

  return (
    <button
      type="button"
      role={showRadio ? "radio" : undefined}
      aria-checked={showRadio ? selected : undefined}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-left transition-all",
        "disabled:pointer-events-none disabled:opacity-50",
        isSuccess
          ? "border-success/40 bg-success/5 hover:bg-success/10"
          : selected
            ? "border-primary bg-accent"
            : "border-border bg-muted/40 hover:border-primary/50 hover:bg-accent/60"
      )}
    >
      <Icon
        className={cn(
          "size-[18px] shrink-0",
          isSuccess ? "text-success" : "text-primary"
        )}
      />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-[13px] font-medium",
            isSuccess ? "text-success" : "text-foreground"
          )}
        >
          {label}
        </span>
        <span className="mt-0.5 block text-[11px] text-muted-foreground">
          {description}
        </span>
      </span>
      {showRadio && (
        <span
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded-full border-2",
            selected ? "border-primary" : "border-muted-foreground/40"
          )}
        >
          {selected && <span className="size-2 rounded-full bg-primary" />}
        </span>
      )}
    </button>
  )
}
