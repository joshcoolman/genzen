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
import styles from './ad-panel.module.css'
import type { ADMessage } from '#/features/ad/hooks/useADChat'
import { useADChat } from '#/features/ad/hooks/useADChat'
import { useAnthropicKey } from '#/features/ad/hooks/useAnthropicKey'
import { useADOpen } from '#/lib/use-ad-open'
import { cx } from '#/lib/utils'

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
    <aside className={cx(styles.root, isOpen && styles.rootOpen)}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.identity}>
          <span className={styles.name}>AD</span>
          <span className={styles.role}>Assistant Director</span>
        </div>
        <div className={styles.headerActions}>
          {hasKey && (
            <button
              onClick={clearApiKey}
              className={styles.iconButton}
              aria-label="Clear API key"
              title="Clear API key"
            >
              <KeyRound className={styles.iconButtonIcon} />
            </button>
          )}
          <button
            onClick={() => setIsOpen(false)}
            className={styles.iconButton}
            aria-label="Close AD panel"
          >
            <X className={styles.iconButtonIcon} />
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
        <div className={styles.error}>
          <AlertCircle className={styles.errorIcon} />
          <p className={styles.errorText}>{error}</p>
          <button
            onClick={clearError}
            className={styles.errorDismiss}
            aria-label="Dismiss error"
          >
            <X className={styles.smallIcon} />
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
        <div className={styles.footer}>
          <button onClick={handleCopy} className={styles.footerButton}>
            {copyState === 'copied' ? (
              <Check className={styles.smallIcon} />
            ) : (
              <Clipboard className={styles.smallIcon} />
            )}
            {copyState === 'copied' ? 'Copied' : 'Copy'}
          </button>
          <button onClick={clearHistory} className={styles.footerButton}>
            <Trash2 className={styles.smallIcon} />
            Clear
          </button>
        </div>
      )}
    </>
  )
}
