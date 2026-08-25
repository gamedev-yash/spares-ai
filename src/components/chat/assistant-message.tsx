import { OptionCard } from "@/components/chat/option-card"
import type { AssistantMessage } from "@/lib/api/chat"
import { cn } from "@/lib/utils"

function FormattedText({ text }: { text: string }) {
  const paragraphs = text.split("\n\n")
  return (
    <div className="space-y-2">
      {paragraphs.map((paragraph, pIndex) => {
        const parts = paragraph.split(/(\*\*[^*]+\*\*)/g).filter(Boolean)
        return (
          <p key={pIndex}>
            {parts.map((part, i) =>
              part.startsWith("**") && part.endsWith("**") ? (
                <strong key={i} className="font-semibold">
                  {part.slice(2, -2)}
                </strong>
              ) : (
                part
              )
            )}
          </p>
        )
      })}
    </div>
  )
}

export function AssistantMessageBubble({
  message,
  onOptionSelect,
  disabled,
}: {
  message: AssistantMessage
  onOptionSelect: (optionId: string) => void
  disabled: boolean
}) {
  const isUser = message.role === "user"

  return (
    <div className={cn("flex flex-col gap-1.5", isUser ? "max-w-[75%] self-end" : "w-full max-w-[560px] self-start")}>
      {message.text && (
        <div
          className={cn(
            "rounded-xl px-3.5 py-2.5 text-[13px] leading-[1.55]",
            isUser ? "bg-primary text-primary-foreground" : "w-full border border-border bg-card text-foreground"
          )}
        >
          <FormattedText text={message.text} />
        </div>
      )}

      {message.options && message.options.length > 0 && (
        <div className="flex w-full flex-col gap-1.5" role="radiogroup">
          {message.options.map((option) => (
            <OptionCard
              key={option.id}
              icon="lightbulb"
              label={option.label}
              description={option.description ?? ""}
              showRadio={false}
              disabled={disabled}
              onSelect={() => onOptionSelect(option.id)}
            />
          ))}
        </div>
      )}

      <div className={cn("text-[11px] text-muted-foreground", isUser && "text-right")}>
        {isUser ? "You" : "Spares AI"} ·{" "}
        {new Date(message.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
      </div>
    </div>
  )
}
