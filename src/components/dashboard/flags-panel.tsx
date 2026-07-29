import type { VziFlag } from "@/lib/types"

export function FlagsPanel({ flags }: { flags: VziFlag[] }) {
  return (
    <div className="flex flex-col gap-3">
      {flags.map((flag, i) => (
        <div
          key={flag.title}
          className="rounded-r-lg border-l-4 border-warning bg-warning/10 p-3.5"
        >
          <div className="text-sm font-semibold text-foreground">
            {i + 1}. {flag.title}
          </div>
          <div className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            {flag.body}
          </div>
        </div>
      ))}
    </div>
  )
}
