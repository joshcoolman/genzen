import { useEffect, useRef, useState } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { Check, Copy } from 'lucide-react'
import type { ADMessage } from '../hooks/useADChat'
import { cn } from '@/lib/utils'

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

function MessageBubble({ message }: { message: ADMessage }) {
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
                    key={i}
                    src={`data:${img.mediaType};base64,${img.base64}`}
                    alt={`Attached ${i + 1}`}
                    className="h-20 w-20 rounded border border-primary-foreground/20 object-cover"
                  />
                ) : (
                  <div
                    key={i}
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

  return (
    <div className="group flex gap-1">
      <div
        className="ad-prose max-w-[85%] text-sm"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <CopyButton text={message.content} />
    </div>
  )
}

export function ChatMessages({ messages }: { messages: Array<ADMessage> }) {
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
      {messages.map((msg, i) => (
        <MessageBubble key={i} message={msg} />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
