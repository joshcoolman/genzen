import { useState } from 'react'
import { Check, Clipboard, KeyRound, Save, Trash2, X } from 'lucide-react'
import { useAnthropicKey } from '../hooks/useAnthropicKey'
import { useADChat } from '../hooks/useADChat'
import { useADContext } from '../context/ad-context'

import { ADSetup } from './ADSetup'
import { ChatMessages } from './ChatMessages'
import { ChatInput } from './ChatInput'
import type { ADMessage } from '../hooks/useADChat'
import { useADOpen } from '@/lib/use-ad-open'
import { useAuth } from '@/lib/auth'
import { saveNote } from '@/features/notes/server/save-note.server'
import { cn } from '@/lib/utils'
import { savePrompt } from '@/features/prompts/server/save-prompt.server'

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
        'fixed right-0 top-0 z-40 hidden h-screen w-[640px] flex-col border-l border-border bg-background transition-transform duration-300 md:flex',
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
  const { messages, sendMessage, isStreaming, abort, clearHistory } =
    useADChat()
  const { loadedNote, clearLoadedNote } = useADContext()
  const { session } = useAuth()
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>(
    'idle',
  )

  const handleCopyPrompt = (prompt: string) => {
    navigator.clipboard.writeText(prompt)
  }

  const handleSavePrompt = async (title: string, content: string) => {
    if (!session?.access_token) return
    try {
      await savePrompt({
        data: {
          accessToken: session.access_token,
          title,
          content,
        },
      })
    } catch (err) {
      console.error('Failed to save prompt:', err)
    }
  }

  function handleCopy() {
    const md = formatChatAsMarkdown(messages)
    navigator.clipboard.writeText(md)
    setCopyState('copied')
    setTimeout(() => setCopyState('idle'), 1500)
  }

  async function handleSave() {
    if (!session?.access_token || messages.length === 0) return
    setSaveState('saving')
    try {
      const firstUserMsg = messages.find((m: ADMessage) => m.role === 'user')
      const title = firstUserMsg
        ? firstUserMsg.content.slice(0, 60)
        : 'Untitled'
      const content = formatChatAsMarkdown(messages)
      await saveNote({
        data: {
          accessToken: session.access_token,
          title,
          content,
        },
      })
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 1500)
    } catch (err) {
      console.error('Failed to save note:', err)
      setSaveState('idle')
    }
  }

  return (
    <>
      {loadedNote && (
        <div className="flex items-center gap-1 border-b border-border bg-muted/50 px-4 py-1.5">
          <span className="truncate text-xs text-muted-foreground">
            Context: {loadedNote.title}
          </span>
          <button
            onClick={clearLoadedNote}
            className="ml-auto shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Clear loaded note"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      <ChatMessages
        messages={messages}
        onCopyPrompt={handleCopyPrompt}
        onSavePrompt={handleSavePrompt}
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
          {session && (
            <button
              onClick={handleSave}
              disabled={saveState === 'saving'}
              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
            >
              {saveState === 'saved' ? (
                <Check className="h-3 w-3" />
              ) : (
                <Save className="h-3 w-3" />
              )}
              {saveState === 'saved'
                ? 'Saved'
                : saveState === 'saving'
                  ? 'Saving...'
                  : 'Save'}
            </button>
          )}
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
