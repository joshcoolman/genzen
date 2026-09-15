'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader, Send } from 'lucide-react'
import styles from './chat-panel.module.css'
import type { ChatTurn } from '../../../_lib/types'
import { Button, Textarea } from '#/components'

/**
 * The conversation, under the player (#670): every question and the line the
 * character answered with, then a box for the next one.
 *
 * The character's description is not printed. The surprise is who turns up in
 * the clip, and a paragraph naming them above the stage would spoil it before
 * the clip had loaded. The transcript shows the words, which is what you need
 * to ask a follow-up.
 */
export function ChatPanel({
  turns,
  busy,
  answering,
  onAsk,
}: {
  turns: Array<ChatTurn>
  /** A question is with the model or being submitted. */
  busy: boolean
  /** Turn ids whose clips are still being made. */
  answering: Set<string>
  onAsk: (question: string) => void
}) {
  const [draft, setDraft] = useState('')
  const end = useRef<HTMLLIElement>(null)

  /* The newest turn at the bottom, and scrolled to: a transcript you have to
     scroll to read the answer you just got is a transcript read once. */
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' })
  }, [turns.length])

  const trimmed = draft.trim()
  const submit = () => {
    if (!trimmed || busy) return
    onAsk(trimmed)
    setDraft('')
  }

  return (
    <div className={styles.panel}>
      <ol className={styles.transcript}>
        {turns.length === 0 && (
          <li className={styles.empty}>
            Ask anything. Someone will answer, on camera.
          </li>
        )}
        {turns.map((turn) => (
          <li key={turn.id} className={styles.turn}>
            <p className={styles.question}>{turn.question}</p>
            <p className={styles.line}>
              {turn.line}
              {answering.has(turn.id) && (
                <span className={styles.making}>
                  <Loader size={12} /> making the clips
                </span>
              )}
            </p>
          </li>
        ))}
        <li ref={end} aria-hidden />
      </ol>
      <div className={styles.compose}>
        <Textarea
          className={styles.input}
          value={draft}
          placeholder={turns.length === 0 ? 'Ask a question' : 'Ask another'}
          rows={2}
          maxLength={2000}
          disabled={busy}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends, Shift+Enter breaks a line: a chat box, not a form.
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
        />
        <Button
          size="sm"
          disabled={!trimmed || busy}
          onClick={submit}
          aria-label="Ask"
          title="Ask"
        >
          {busy ? <Loader size={16} /> : <Send size={16} />}
        </Button>
      </div>
    </div>
  )
}
