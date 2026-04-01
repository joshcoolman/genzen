import { useEffect, useRef, useState } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { Check, Copy, Save } from 'lucide-react'
import type {
  ADMessage,
  ClarifyingCardTool,
  PromptCardTool,
} from '../hooks/useADChat'
import { cn } from '@/lib/utils'

interface PromptCardProps extends PromptCardTool {
  onCopy: (prompt: string) => void
  onSave: (title: string, content: string) => void
}

function PromptCard({ prompt, title, tags, onCopy, onSave }: PromptCardProps) {
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleCopy = () => {
    onCopy(prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSave = () => {
    const saveTitle = title || 'Generated Prompt'
    onSave(saveTitle, prompt)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="my-3 rounded-lg border border-border bg-card p-4">
      {/* Title */}
      {title && <div className="mb-2 text-sm font-medium">{title}</div>}

      {/* Prompt content */}
      <div className="mb-3 whitespace-pre-wrap rounded bg-muted/50 p-3 font-mono text-sm leading-relaxed">
        {prompt}
      </div>

      {/* Tags */}
      {tags && tags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {tags.map((tag, i) => (
            <span
              key={`${tag}-${i}`}
              className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs transition-colors hover:bg-muted"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              Copy
            </>
          )}
        </button>
        <button
          onClick={handleSave}
          className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs transition-colors hover:bg-muted"
        >
          {saved ? (
            <>
              <Check className="h-3 w-3" />
              Saved
            </>
          ) : (
            <>
              <Save className="h-3 w-3" />
              Save
            </>
          )}
        </button>
      </div>
    </div>
  )
}

interface ClarifyingCardProps extends ClarifyingCardTool {
  onSelectOption: (option: string) => void
}

function ClarifyingCard({
  interpretation,
  question,
  options,
  onSelectOption,
}: ClarifyingCardProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [showFreeText, setShowFreeText] = useState(false)
  const [freeText, setFreeText] = useState('')
  const isInert = selectedOption !== null

  const handleSelect = (option: string) => {
    if (isInert) return
    setSelectedOption(option)
    onSelectOption(option)
  }

  const handleFreeTextSubmit = () => {
    if (!freeText.trim() || isInert) return
    setSelectedOption(freeText.trim())
    onSelectOption(freeText.trim())
    setShowFreeText(false)
  }

  return (
    <div className="my-3 rounded-lg border border-border bg-card p-4">
      {/* Interpretation */}
      <p className="mb-3 text-xs italic text-muted-foreground">
        {interpretation}
      </p>

      {/* Question */}
      <p className="mb-3 text-sm font-medium">{question}</p>

      {/* Options */}
      <div className="flex flex-col gap-2">
        {options.map((option, i) => {
          const isSelected = selectedOption === option
          const isDimmed = isInert && !isSelected
          return (
            <button
              key={`${option}-${i}`}
              onClick={() => handleSelect(option)}
              disabled={isInert}
              className={cn(
                'flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors',
                isSelected
                  ? 'border-primary bg-primary/10 text-primary'
                  : isDimmed
                    ? 'border-border bg-background text-muted-foreground opacity-40'
                    : 'border-border bg-background hover:bg-muted',
              )}
            >
              {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
              {option}
            </button>
          )
        })}

        {/* Free text escape hatch */}
        {!isInert && !showFreeText && (
          <button
            onClick={() => setShowFreeText(true)}
            className="text-left text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Tell me more...
          </button>
        )}
        {!isInert && showFreeText && (
          <div className="flex gap-2">
            <input
              autoFocus
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleFreeTextSubmit()
                if (e.key === 'Escape') setShowFreeText(false)
              }}
              placeholder="Type your answer..."
              className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
            <button
              onClick={handleFreeTextSubmit}
              disabled={!freeText.trim()}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-40 transition-colors"
            >
              Send
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      onClick={handleCopy}
      className="mt-1 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
      aria-label="Copy message"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </button>
  )
}

function MessageBubble({
  message,
  onCopyPrompt,
  onSavePrompt,
  onSelectOption,
}: {
  message: ADMessage
  onCopyPrompt: (prompt: string) => void
  onSavePrompt: (title: string, content: string) => void
  onSelectOption: (option: string) => void
}) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
          {message.images && message.images.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {message.images.map((img, i) =>
                img.base64 ? (
                  <img
                    key={`img-${message.id}-${i}`}
                    src={`data:${img.mediaType};base64,${img.base64}`}
                    alt={`Attached ${i + 1}`}
                    className="h-20 w-20 rounded border border-primary-foreground/20 object-cover"
                  />
                ) : (
                  <div
                    key={`img-placeholder-${message.id}-${i}`}
                    className="flex h-20 w-20 items-center justify-center rounded border border-primary-foreground/20 bg-primary-foreground/10 text-xs text-primary-foreground/60"
                  >
                    Image
                  </div>
                ),
              )}
            </div>
          )}
          {message.content}
        </div>
      </div>
    )
  }

  const html = DOMPurify.sanitize(
    marked.parse(message.content, { async: false }),
  )

  const isEmpty =
    !message.content && (!message.toolCalls || message.toolCalls.length === 0)

  return (
    <div className="flex w-full flex-col gap-2">
      {isEmpty && (
        <div className="flex items-center gap-1 px-1 py-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60" />
        </div>
      )}
      {message.content && (
        <div className="group flex gap-1">
          <div
            className="ad-prose max-w-[85%] text-sm"
            dangerouslySetInnerHTML={{ __html: html }}
          />
          <CopyButton text={message.content} />
        </div>
      )}
      {message.toolCalls && message.toolCalls.length > 0 && (
        <div className="w-full">
          {message.toolCalls.map((toolCall) =>
            toolCall.name === 'create_clarifying_card' ? (
              <ClarifyingCard
                key={toolCall.id}
                {...toolCall.input}
                onSelectOption={onSelectOption}
              />
            ) : (
              <PromptCard
                key={toolCall.id}
                {...toolCall.input}
                onCopy={onCopyPrompt}
                onSave={onSavePrompt}
              />
            ),
          )}
        </div>
      )}
    </div>
  )
}

export function ChatMessages({
  messages,
  onCopyPrompt,
  onSavePrompt,
  onSelectOption,
}: {
  messages: Array<ADMessage>
  onCopyPrompt: (prompt: string) => void
  onSavePrompt: (title: string, content: string) => void
  onSelectOption: (option: string) => void
}) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const shouldAutoScroll = useRef(true)

  // Track if user has scrolled up
  function handleScroll() {
    const el = containerRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    shouldAutoScroll.current = atBottom
  }

  // Auto-scroll on new messages
  useEffect(() => {
    if (shouldAutoScroll.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">
          Ready to chat. Paste images or send a message below.
        </p>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={cn(
        'flex flex-1 flex-col gap-3 overflow-y-auto p-4',
        // Minimal prose styling for assistant markdown
        '[&_.ad-prose_p]:mb-2 [&_.ad-prose_p:last-child]:mb-0',
        '[&_.ad-prose_pre]:my-2 [&_.ad-prose_pre]:rounded [&_.ad-prose_pre]:bg-muted [&_.ad-prose_pre]:p-2 [&_.ad-prose_pre]:text-xs',
        '[&_.ad-prose_code]:rounded [&_.ad-prose_code]:bg-muted [&_.ad-prose_code]:px-1 [&_.ad-prose_code]:text-xs',
        '[&_.ad-prose_ul]:my-1 [&_.ad-prose_ul]:list-disc [&_.ad-prose_ul]:pl-4',
        '[&_.ad-prose_ol]:my-1 [&_.ad-prose_ol]:list-decimal [&_.ad-prose_ol]:pl-4',
      )}
    >
      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          onCopyPrompt={onCopyPrompt}
          onSavePrompt={onSavePrompt}
          onSelectOption={onSelectOption}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
