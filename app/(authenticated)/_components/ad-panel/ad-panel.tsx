'use client'

import { useState } from 'react'
import {
  AlertCircle,
  Check,
  Clipboard,
  KeyRound,
  Trash2,
  X,
} from 'lucide-react'

import { ADSetup } from '../ad-setup/ad-setup'
import { ChatMessages } from '../chat-messages/chat-messages'
import { ChatInput } from '../chat-input/chat-input'
import { SkillChipRow } from '../skill-chip-row/skill-chip-row'
import type { ADMessage } from '#/features/ad/hooks/useADChat'
import { useADChat } from '#/features/ad/hooks/useADChat'
import { useAnthropicKey } from '#/features/ad/hooks/useAnthropicKey'
import { useADOpen } from '#/lib/use-ad-open'
import { cn } from '#/lib/utils'

function formatChatAsMarkdown(messages: Array<ADMessage>): string {
  return messages
    .map((m) => {
      const label = m.role === 'user' ? '**User:**' : '**AD:**'
      return `${label}\n${m.content}`
    })
    .join('\n\n')
}

export function ADPanel() {
  const { isOpen, setIsOpen } = useADOpen()
  const { apiKey, clearApiKey } = useAnthropicKey()
  const hasKey = Boolean(apiKey)

  return (
    <aside
      className={cn(
        'fixed right-0 top-0 z-40 hidden h-screen w-80 flex-col border-l border-border bg-background transition-transform duration-300 md:flex',
        isOpen ? 'translate-x-0' : 'translate-x-full',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">AD</span>
          <span className="text-xs text-muted-foreground">
            Assistant Director
          </span>
        </div>
        <div className="flex items-center gap-1">
          {hasKey && (
            <button
              onClick={clearApiKey}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Clear API key"
              title="Clear API key"
            >
              <KeyRound className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => setIsOpen(false)}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Close AD panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {hasKey ? <ChatBody /> : <ADSetup />}
    </aside>
  )
}

function ChatBody() {
  const {
    messages,
    sendMessage,
    isStreaming,
    abort,
    clearHistory,
    error,
    clearError,
  } = useADChat()
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle')

  const handleCopyPrompt = (prompt: string) => {
    navigator.clipboard.writeText(prompt)
  }

  function handleCopy() {
    const md = formatChatAsMarkdown(messages)
    navigator.clipboard.writeText(md)
    setCopyState('copied')
    setTimeout(() => setCopyState('idle'), 1500)
  }

  return (
    <>
      <ChatMessages
        messages={messages}
        onCopyPrompt={handleCopyPrompt}
        onSelectOption={sendMessage}
      />
      {error && (
        <div className="flex items-start gap-2 border-t border-destructive/30 bg-destructive/10 px-4 py-2">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
          <p className="flex-1 text-xs leading-relaxed text-destructive">
            {error}
          </p>
          <button
            onClick={clearError}
            className="shrink-0 rounded p-0.5 text-destructive/70 transition-colors hover:bg-destructive/10 hover:text-destructive"
            aria-label="Dismiss error"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      <SkillChipRow
        onLaunch={(text) => sendMessage(text)}
        disabled={isStreaming}
      />
      <ChatInput
        onSend={sendMessage}
        onAbort={abort}
        isStreaming={isStreaming}
      />
      {messages.length > 0 && !isStreaming && (
        <div className="flex items-center justify-center gap-1 border-t border-border px-4 py-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            {copyState === 'copied' ? (
              <Check className="h-3 w-3" />
            ) : (
              <Clipboard className="h-3 w-3" />
            )}
            {copyState === 'copied' ? 'Copied' : 'Copy'}
          </button>
          <button
            onClick={clearHistory}
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Trash2 className="h-3 w-3" />
            Clear
          </button>
        </div>
      )}
    </>
  )
}
