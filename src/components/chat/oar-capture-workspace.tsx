"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Send } from "lucide-react"

import { ChatHeader } from "@/components/chat/chat-header"
import { OptionCard } from "@/components/chat/option-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { OAR_CAPTURE_SESSION_ID } from "@/lib/constants"
import type { UtilisationPlant } from "@/lib/utilisation-data"
import { cn, formatDateDMY, formatTime12h } from "@/lib/utils"

// Initiative 13 CAPTURE stage, hosted in the same chat experience as
// Initiatives 9/10 — a fixed script (no live model), same message/bubble/
// option-card grammar as the rest of /chat. Free-text answers here have no
// scripted reply engine to drive them (the standard options/actions model
// only supports fixed multiple-choice), so this session is rendered by this
// dedicated workspace rather than the generic ChatWorkspace.

type Step =
  | "material"
  | "plant"
  | "purpose"
  | "requester"
  | "departmentCC"
  | "date"
  | "summary"
  | "done"

interface Bubble {
  role: "ai" | "user"
  text: string
  time: string
}

interface Collected {
  materialCode: string
  materialDescription: string
  plant: UtilisationPlant | null
  purpose: string
  requester: string
  department: string
  costCentre: string
  plannedConsumptionDate: string // "YYYY-MM-DD"
}

const EMPTY_COLLECTED: Collected = {
  materialCode: "",
  materialDescription: "",
  plant: null,
  purpose: "",
  requester: "",
  department: "",
  costCentre: "",
  plannedConsumptionDate: "",
}

const FIRST_QUESTION =
  "Hi — I'll help you capture a consumption plan for this request. What material do you need?"

let materialSeq = 0

export function OarCaptureWorkspace() {
  const [step, setStep] = useState<Step>("material")
  const [transcript, setTranscript] = useState<Bubble[]>([
    { role: "ai", text: FIRST_QUESTION, time: formatTime12h(new Date()) },
  ])
  const [collected, setCollected] = useState<Collected>(EMPTY_COLLECTED)
  const [draft, setDraft] = useState("")
  const [dateDraft, setDateDraft] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [transcript, step])

  function say(role: "ai" | "user", text: string) {
    setTranscript((prev) => [...prev, { role, text, time: formatTime12h(new Date()) }])
  }

  function submitMaterial() {
    const value = draft.trim()
    if (!value) return
    materialSeq += 1
    const code = `500-9${(materialSeq % 900).toString().padStart(3, "0")}`
    setCollected((c) => ({ ...c, materialDescription: value, materialCode: code }))
    say("user", value)
    say("ai", `Got it — I'll file this as **${code} · ${value}**. Which plant is it for?`)
    setDraft("")
    setStep("plant")
  }

  function selectPlant(plant: UtilisationPlant) {
    setCollected((c) => ({ ...c, plant }))
    say("user", plant)
    say("ai", "Noted. What's this needed for — the reason or job it supports?")
    setStep("purpose")
  }

  function submitPurpose() {
    const value = draft.trim()
    if (!value) return
    setCollected((c) => ({ ...c, purpose: value }))
    say("user", value)
    say("ai", "Understood. Who's requesting it?")
    setDraft("")
    setStep("requester")
  }

  function submitRequester() {
    const value = draft.trim()
    if (!value) return
    setCollected((c) => ({ ...c, requester: value }))
    say("user", value)
    say(
      "ai",
      "And which department — plus a cost centre or work order if you have one?"
    )
    setDraft("")
    setStep("departmentCC")
  }

  function submitDepartmentCC() {
    const value = draft.trim()
    if (!value) return
    const [department, costCentre = ""] = value.split(",").map((s) => s.trim())
    setCollected((c) => ({ ...c, department: department ?? value, costCentre }))
    say("user", value)
    say("ai", "Last thing — when do you plan to consume it?")
    setDraft("")
    setStep("date")
  }

  function submitDate() {
    if (!dateDraft) return
    const [year, month, day] = dateDraft.split("-").map(Number)
    const label = formatDateDMY(new Date(year, month - 1, day))
    setCollected((c) => ({ ...c, plannedConsumptionDate: dateDraft }))
    say("user", label)
    say(
      "ai",
      "Here's what I've got — confirm and I'll log the consumption plan against this request."
    )
    setStep("summary")
  }

  function confirmCapture() {
    if (!collected.plant) return
    const id = `SPR-TRK-4${(300 + materialSeq).toString().padStart(3, "0")}`
    say(
      "ai",
      `Captured — tracking ID **${id}**. I'll link this to your SAP reservation once it's raised, and it'll appear in the Reservation-to-Consumption Ledger under Utilisation Tracking.`
    )
    setStep("done")
  }

  const dateLabel = dateDraft
    ? (() => {
        const [y, m, d] = dateDraft.split("-").map(Number)
        return formatDateDMY(new Date(y, m - 1, d))
      })()
    : null

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <ChatHeader
        title="New OAR request — consumption plan"
        sessionId={OAR_CAPTURE_SESSION_ID}
      />

      <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {transcript.map((bubble, i) => (
          <div
            key={i}
            className={cn(
              "flex flex-col gap-1.5",
              bubble.role === "user" ? "max-w-[75%] self-end" : "w-full max-w-[560px] self-start"
            )}
          >
            <div
              className={cn(
                "rounded-xl px-3.5 py-2.5 text-[13px] leading-[1.55]",
                bubble.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "w-full border border-border bg-card text-foreground"
              )}
            >
              {bubble.text.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
                part.startsWith("**") && part.endsWith("**") ? (
                  <strong key={j} className="font-semibold">
                    {part.slice(2, -2)}
                  </strong>
                ) : (
                  part
                )
              )}
            </div>
            <div
              className={cn(
                "text-[11px] text-muted-foreground",
                bubble.role === "user" && "text-right"
              )}
            >
              {bubble.role === "user" ? "You" : "Spares AI"} · {bubble.time}
            </div>
          </div>
        ))}

        {step === "plant" && (
          <div className="flex w-full max-w-[560px] flex-col gap-1.5 self-start">
            <OptionCard
              icon="wrench"
              label="Gamsberg"
              description="Mining & concentrator operations"
              showRadio={false}
              onSelect={() => selectPlant("Gamsberg")}
            />
            <OptionCard
              icon="layers"
              label="Black Mountain"
              description="BMM — concentrator & instrumentation"
              showRadio={false}
              onSelect={() => selectPlant("Black Mountain")}
            />
          </div>
        )}

        {step === "date" && (
          <div className="flex w-full max-w-[560px] items-center gap-2 self-start">
            <Input
              type="date"
              value={dateDraft}
              onChange={(e) => setDateDraft(e.target.value)}
              className="h-9"
            />
            <Button disabled={!dateDraft} onClick={submitDate}>
              Continue
            </Button>
          </div>
        )}

        {step === "summary" && (
          <div className="flex w-full max-w-[560px] flex-col gap-3 self-start rounded-xl border border-border bg-card p-4">
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
              <span className="text-muted-foreground">Material</span>
              <span className="font-medium text-foreground">
                {collected.materialCode} · {collected.materialDescription}
              </span>
              <span className="text-muted-foreground">Plant</span>
              <span className="font-medium text-foreground">{collected.plant}</span>
              <span className="text-muted-foreground">Purpose</span>
              <span className="font-medium text-foreground">{collected.purpose}</span>
              <span className="text-muted-foreground">Requester</span>
              <span className="font-medium text-foreground">{collected.requester}</span>
              <span className="text-muted-foreground">Department</span>
              <span className="font-medium text-foreground">
                {collected.department}
                {collected.costCentre ? ` · ${collected.costCentre}` : ""}
              </span>
              <span className="text-muted-foreground">Planned</span>
              <span className="font-medium text-foreground">{dateLabel}</span>
            </div>
            <Button onClick={confirmCapture}>Capture consumption plan</Button>
          </div>
        )}

        {step === "done" && (
          <Link
            href="/utilisation"
            className="mt-1 inline-flex w-fit items-center gap-1.5 self-start rounded-lg bg-primary px-3.5 py-2 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            View in Utilisation Tracker
          </Link>
        )}
      </div>

      {(step === "material" || step === "purpose" || step === "requester" || step === "departmentCC") && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (step === "material") submitMaterial()
            else if (step === "purpose") submitPurpose()
            else if (step === "requester") submitRequester()
            else submitDepartmentCC()
          }}
          className="flex items-center gap-2 border-t border-border bg-muted/40 px-4 py-3"
        >
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={
              step === "material"
                ? "e.g. Conveyor belt scraper blade"
                : step === "purpose"
                  ? "e.g. Scraper blade wear replacement, CV-14 return station"
                  : step === "requester"
                    ? "e.g. T. Mokoena"
                    : "e.g. Mining Maintenance, CC-4021-MILL"
            }
            className="h-9 flex-1"
          />
          <Button type="submit" size="icon" disabled={!draft.trim()} aria-label="Send message">
            <Send className="size-4" />
          </Button>
        </form>
      )}
    </div>
  )
}
