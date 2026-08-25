import { Info } from "lucide-react"

const MESSAGES: Record<
  "advisory" | "not-a-block" | "human-approves" | "demo-no-persistence",
  string
> = {
  advisory:
    "Recommendations are advisory. SAP is updated only after human approval.",
  "not-a-block":
    "This is a warning, not a block. A second purchase can be legitimate.",
  "human-approves":
    "AI recommends; humans approve. All stock actions happen in SAP.",
  "demo-no-persistence": "Nothing persists — decisions reset on refresh.",
}

export function AdvisoryNotice({
  kind,
}: {
  kind: "advisory" | "not-a-block" | "human-approves" | "demo-no-persistence"
}) {
  return (
    <div className="flex items-start gap-1.5 rounded-lg bg-accent px-2.5 py-2 text-[12px] text-accent-foreground">
      <Info className="mt-0.5 size-3.5 shrink-0" />
      <span>{MESSAGES[kind]}</span>
    </div>
  )
}
