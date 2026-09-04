import { PackageCheck, PackageSearch } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { OARConsumptionPlanExtension } from "@/features/initiative-13/components/oar-consumption-plan-extension"
import { isOARMaterial } from "@/features/initiative-13/selectors/oar-lookup"

/**
 * The material-classification checkpoint in the chat's request flow
 * (mounted once in `chat-workspace.tsx`, between the transcript and the
 * input). Every material gets classified OAR / Non-OAR, and the next step
 * branches accordingly:
 *   - OAR   -> Initiative 13's consumption-plan capture form
 *   - Non-OAR -> a short note that the standard flow above (chat-driven
 *     alternate sourcing) is all that's required, nothing further to capture
 * Only the classification body (`isOARMaterial`) and the OAR-side extension
 * component live in Initiative 13's own folder — this slot itself never
 * needs another edit to add that branch.
 */
export function RRExtensionSlot({
  materialId,
  requestType,
}: {
  materialId: string
  requestType: string
}) {
  const isOAR = isOARMaterial(materialId)

  return (
    <div className="max-h-[45vh] shrink-0 overflow-y-auto border-t border-border bg-muted/20 px-4 py-3">
      <div className="mb-2 flex items-center gap-1.5">
        <span className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
          Material classification
        </span>
        <StatusBadge tone={isOAR ? "warning" : "default"}>
          {isOAR ? (
            <span className="flex items-center gap-1">
              <PackageSearch className="size-3" />
              OAR — Order as Required
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <PackageCheck className="size-3" />
              Non-OAR — Stocked material
            </span>
          )}
        </StatusBadge>
      </div>

      {isOAR ? (
        <OARConsumptionPlanExtension materialId={materialId} requestType={requestType} />
      ) : (
        <p className="text-[11px] text-muted-foreground">
          This is a stocked material — the standard alternate-sourcing flow above covers it.
          No consumption-plan capture is required.
        </p>
      )}
    </div>
  )
}
