import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldControl, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"

export function AttestationBlock({
  statement,
  confirmed,
  onConfirmedChange,
  note,
  onNoteChange,
  noteLabel = "Note",
  noteRequired = false,
}: {
  statement: string
  confirmed: boolean
  onConfirmedChange: (confirmed: boolean) => void
  note: string
  onNoteChange: (note: string) => void
  noteLabel?: string
  noteRequired?: boolean
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-3.5">
      <label className="flex items-start gap-2.5 text-sm text-foreground">
        <Checkbox
          checked={confirmed}
          onCheckedChange={onConfirmedChange}
          className="mt-0.5"
        />
        {statement}
      </label>
      <Field>
        <FieldLabel>
          {noteLabel}
          {noteRequired && <span className="text-destructive"> *</span>}
        </FieldLabel>
        <FieldControl
          render={
            <Textarea
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              required={noteRequired}
            />
          }
        />
      </Field>
    </div>
  )
}
