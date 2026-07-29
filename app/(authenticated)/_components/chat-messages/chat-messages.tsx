'use client'

import { useEffect, useRef, useState } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { Check, Copy } from 'lucide-react'
import { SkillLoadedCard } from '../skill-loaded-card/skill-loaded-card'
import styles from './chat-messages.module.css'
import type {
  ADMessage,
  ClarifyingCardTool,
  PromptCardTool,
} from '#/features/ad/hooks/useADChat'
import { cx } from '#/lib/utils'

interface PromptCardProps extends PromptCardTool {
  onCopy: (prompt: string) => void
}

function PromptCard({ prompt, title, tags, onCopy }: PromptCardProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    onCopy(prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={styles.card}>
      {/* Title */}
      {title && <div className={styles.cardTitle}>{title}</div>}

      {/* Prompt content */}
      <div className={styles.promptBody}>{prompt}</div>

      {/* Tags */}
      {tags && tags.length > 0 && (
        <div className={styles.tags}>
          {tags.map((tag, i) => (
            <span key={`${tag}-${i}`} className={styles.tag}>
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className={styles.cardActions}>
        <button onClick={handleCopy} className={styles.cardButton}>
          {copied ? (
            <>
              <Check className={styles.smallIcon} />
              Copied
            </>
          ) : (
            <>
              <Copy className={styles.smallIcon} />
              Copy
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
    <div className={styles.card}>
      {/* Interpretation */}
      <p className={styles.interpretation}>{interpretation}</p>

      {/* Question */}
      <p className={styles.question}>{question}</p>

      {/* Options */}
      <div className={styles.options}>
        {options.map((option, i) => {
          const isSelected = selectedOption === option
          const isDimmed = isInert && !isSelected
          return (
            <button
              key={`${option}-${i}`}
              onClick={() => handleSelect(option)}
              disabled={isInert}
              className={cx(
                styles.option,
                isSelected && styles.optionSelected,
                isDimmed && styles.optionDimmed,
              )}
            >
              {isSelected && <Check className={styles.optionIcon} />}
              {option}
            </button>
          )
        })}

        {/* Free text escape hatch */}
        {!isInert && !showFreeText && (
          <button
            onClick={() => setShowFreeText(true)}
            className={styles.freeTextToggle}
          >
            Tell me more...
          </button>
        )}
        {!isInert && showFreeText && (
          <div className={styles.freeTextRow}>
            <input
              autoFocus
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleFreeTextSubmit()
                if (e.key === 'Escape') setShowFreeText(false)
              }}
              placeholder="Type your answer..."
              className={styles.freeTextInput}
            />
            <button
              onClick={handleFreeTextSubmit}
              disabled={!freeText.trim()}
              className={styles.freeTextSend}
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
      className={styles.copy}
      aria-label="Copy message"
    >
      {copied ? (
        <Check className={styles.smallIcon} />
      ) : (
        <Copy className={styles.smallIcon} />
      )}
    </button>
  )
}

function MessageBubble({
  message,
  onCopyPrompt,
  onSelectOption,
}: {
  message: ADMessage
  onCopyPrompt: (prompt: string) => void
  onSelectOption: (option: string) => void
}) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className={styles.userRow}>
        <div className={styles.userBubble}>
          {message.images && message.images.length > 0 && (
            <div className={styles.userImages}>
              {message.images.map((img, i) => (
                <img
                  key={`img-${message.id}-${i}`}
                  src={img.url}
                  alt={img.title ?? `Attached ${i + 1}`}
                  className={styles.userImage}
                />
              ))}
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
    !message.content &&
    (!message.toolCalls || message.toolCalls.length === 0) &&
    (!message.skillsLoaded || message.skillsLoaded.length === 0)

  return (
    <div className={styles.assistant}>
      {message.skillsLoaded && message.skillsLoaded.length > 0 && (
        <div className={styles.skills}>
          {message.skillsLoaded.map((skill) => (
            <SkillLoadedCard
              key={skill.id}
              name={skill.name}
              body={skill.body}
            />
          ))}
        </div>
      )}
      {isEmpty && (
        <div className={styles.typing}>
          <span className={styles.typingDot} />
          <span className={styles.typingDot} />
          <span className={styles.typingDot} />
        </div>
      )}
      {message.content && (
        <div className={styles.assistantBody}>
          <div
            className={styles.prose}
            dangerouslySetInnerHTML={{ __html: html }}
          />
          <CopyButton text={message.content} />
        </div>
      )}
      {message.toolCalls && message.toolCalls.length > 0 && (
        <div className={styles.toolCalls}>
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
  onSelectOption,
}: {
  messages: Array<ADMessage>
  onCopyPrompt: (prompt: string) => void
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
      <div className={styles.emptyState}>
        <p className={styles.emptyStateText}>
          Ready to chat. Paste images or send a message below.
        </p>
      </div>
    )
  }

  return (
    <div ref={containerRef} onScroll={handleScroll} className={styles.root}>
      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          onCopyPrompt={onCopyPrompt}
          onSelectOption={onSelectOption}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
