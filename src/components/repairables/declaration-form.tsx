"use client"

import { useState } from "react"

import { AttestationBlock } from "@/components/shared/attestation-block"
import { CapturePanel } from "@/components/shared/capture-panel"

export function DeclarationForm({
  materialId,
  prNumber,
  onSubmit,
}: {
  materialId: string
  prNumber?: string
  onSubmit: (data: { confirmed: boolean; note: string }) => void
}) {
  const [open, setOpen] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [note, setNote] = useState("")

  return (
    <CapturePanel
      open={open}
      onOpenChange={setOpen}
      title={
        prNumber
          ? `Declare condition for ${prNumber}`
          : `Declare condition for ${materialId}`
      }
      onSubmit={() => {
        onSubmit({ confirmed, note })
        setOpen(false)
      }}
      submitLabel="Submit declaration"
      disabled={!confirmed || note.trim().length === 0}
    >
      <AttestationBlock
        statement="I confirm this procurement is not a duplicate of the item currently under repair, or a duplicate is genuinely warranted."
        confirmed={confirmed}
        onConfirmedChange={setConfirmed}
        note={note}
        onNoteChange={setNote}
        noteLabel="Note"
        noteRequired
      />
    </CapturePanel>
  )
}
