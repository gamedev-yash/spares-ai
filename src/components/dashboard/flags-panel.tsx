import type { VziFlag } from "@/lib/types"

export function FlagsPanel({ flags }: { flags: VziFlag[] }) {
  if (flags.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No data-quality flags — these numbers are computed directly from the generated
        dataset, so the source tables can&apos;t disagree with each other the way a
        hand-compiled report sometimes does.
      </p>
    )
  }
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
