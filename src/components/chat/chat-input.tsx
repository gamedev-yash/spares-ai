"use client"

import { useState } from "react"
import { Send } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function ChatInput({ onSend }: { onSend: (text: string) => void }) {
  const [value, setValue] = useState("")

  function handleSend() {
    const trimmed = value.trim()
    if (!trimmed) return
    onSend(trimmed)
    setValue("")
  }

  return (
    <div className="flex items-center gap-2 border-t border-border bg-muted/40 px-4 py-3">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            handleSend()
          }
        }}
        placeholder="Ask about materials, alternates, or pricing..."
        className="h-9 flex-1"
      />
      <Button
        size="icon"
        onClick={handleSend}
        disabled={!value.trim()}
        aria-label="Send message"
      >
        <Send className="size-4" />
      </Button>
    </div>
  )
}
