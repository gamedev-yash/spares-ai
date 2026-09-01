"use client"

import { History } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { PLANT_ABBR, type UtilisationLedgerRow } from "@/lib/utilisation-data"
import { formatZAR } from "@/lib/utils"

export function UtilisationTraceDialog({ row }: { row: UtilisationLedgerRow }) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button size="icon-sm" variant="ghost" aria-label="View lifecycle trace" />
        }
      >
        <History className="size-3.5" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{row.materialDescription}</DialogTitle>
          <DialogDescription>
            {row.materialCode} · {row.plant} ({PLANT_ABBR[row.plant]}) ·{" "}
            {row.reservationNumber}/{row.reservationLine}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>Tracking ID: {row.trackingId ?? "Not captured (legacy)"}</span>
          <span>Value: {formatZAR(row.valueZar)}</span>
        </div>

        <ol className="flex flex-col gap-3 border-t border-border pt-3">
          {row.events.map((event, i) => (
            <li key={`${event.stage}-${i}`} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                {i < row.events.length - 1 && (
                  <span className="mt-1 w-px flex-1 bg-border" />
                )}
              </div>
              <div className="pb-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {event.stage}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{event.date}</span>
                </div>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                  {event.detail}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <p className="border-t border-dashed border-border pt-2.5 text-[11px] text-muted-foreground italic">
          Immutable event log — every lifecycle transition is recorded for audit,
          not editable from this workspace.
        </p>
      </DialogContent>
    </Dialog>
  )
}
