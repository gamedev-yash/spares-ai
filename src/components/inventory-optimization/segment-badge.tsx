import { StatusBadge } from "@/components/shared/status-badge"
import type { InventorySegment } from "@/lib/inventory-optimization-data"

/**
 * ABC (value) x XYZ (demand variability). Tone tracks how predictable the
 * demand is, which is what decides whether the model may propose at all —
 * Z is the excluded segment, so it reads as the strongest signal.
 */
const SEGMENT_TONE: Record<
  InventorySegment,
  "default" | "success" | "warning" | "danger"
> = {
  "A-X": "success",
  "B-X": "default",
  "C-Y": "warning",
  Z: "danger",
}

const SEGMENT_TITLE: Record<InventorySegment, string> = {
  "A-X": "High value, smooth demand — strongest candidate for optimization",
  "B-X": "Mid value, smooth demand",
  "C-Y": "Low value, variable demand",
  Z: "Erratic demand or insurance spare — excluded from automatic proposals",
}

export function SegmentBadge({ segment }: { segment: InventorySegment }) {
  return (
    <StatusBadge tone={SEGMENT_TONE[segment]} className="cursor-help">
      <abbr title={SEGMENT_TITLE[segment]} className="no-underline">
        {segment}
      </abbr>
    </StatusBadge>
  )
}
