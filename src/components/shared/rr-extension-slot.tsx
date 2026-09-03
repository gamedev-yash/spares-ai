import { OARConsumptionPlanExtension } from "@/features/initiative-13/components/oar-consumption-plan-extension"
import { isOARMaterial } from "@/features/initiative-13/selectors/oar-lookup"

/**
 * The one controlled insertion point Initiative 13 gets into Initiative 9's
 * request-creation flow (mounted in `chat-workspace.tsx`). Scaffolded once
 * here so Initiative 13 development never needs to touch Initiative 9 files
 * again — only this component's OAR-detection/extension body changes.
 */
export function RRExtensionSlot({
  materialId,
  requestType,
}: {
  materialId: string
  requestType: string
}) {
  if (!isOARMaterial(materialId)) return null
  return (
    <div className="max-h-[45vh] shrink-0 overflow-y-auto border-t border-border bg-muted/20 px-4 py-3">
      <OARConsumptionPlanExtension materialId={materialId} requestType={requestType} />
    </div>
  )
}
