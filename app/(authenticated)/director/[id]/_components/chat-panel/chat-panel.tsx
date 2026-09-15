'use client'

import { useEffect, useState } from 'react'
import { Loader, ScrollText, Send } from 'lucide-react'
import styles from './chat-panel.module.css'
import type { ChatTurn } from '../../../_lib/types'
import { Button, Textarea } from '#/components'

/**
 * What the character is doing while you wait: a word that changes every
 * couple of seconds. None of them says anything about the answer -- they are
 * the shape of thinking, not its content -- and cycling is what makes a long
 * wait read as work rather than a hang. The loader glyph alone said nothing.
 */
const MUSING = [
  'musing',
  'mulling it over',
  'forming an opinion',
  'concocting an explanation',
  'distilling',
  'choosing the words',
  'getting into character',
]

function Musing() {
  const [step, setStep] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setStep((n) => n + 1), 2200)
    return () => clearInterval(timer)
  }, [])
  return (
    <span className={styles.making} aria-live="polite">
      <Loader size={12} /> {MUSING[step % MUSING.length]}...
    </span>
  )
}

/**
 * The question box, under the player (#670), and the intro before the first
 * question. That is all it shows.
 *
 * **The conversation is not on the page.** It is stored and it is valuable --
 * the character, every question, every line -- but the clips are the answer
 * and a transcript beside them read as a chat app with a video attached. So
 * the words are behind a Transcript button, in the same read-only, copyable
 * box Script uses, opened on purpose. The character's description is never
 * printed anywhere: the surprise is who turns up in the clip.
 *
 * What the panel does say is that an answer is still being made, because
 * nothing else on the page says it until a tile lands.
 */
export function ChatPanel({
  turns,
  busy,
  answering,
  onAsk,
  onTranscript,
}: {
  turns: Array<ChatTurn>
  /** A question is with the model or being submitted. */
  busy: boolean
  /** Turn ids whose clips are still being made. */
  answering: Set<string>
  onAsk: (question: string) => void
  /** Open the conversation so far, to read and copy. */
  onTranscript: () => void
}) {
  const [draft, setDraft] = useState('')

  const trimmed = draft.trim()
  const submit = () => {
    if (!trimmed || busy) return
    onAsk(trimmed)
    setDraft('')
  }

  return (
    <div className={styles.panel}>
      {turns.length === 0 ? (
        <p className={styles.empty}>
          A quick experiment. Ask anything and someone, invented on the spot to
          suit the question, answers on camera in a clip or three. Follow-ups go
          to the same character, and the chat names itself from your first
          question. What do you want to know?
        </p>
      ) : (
        <div className={styles.status}>
          {busy || answering.size > 0 ? <Musing /> : <span />}
          <Button size="sm" onClick={onTranscript}>
            <ScrollText size={14} />
            Transcript
          </Button>
        </div>
      )}
      <div className={styles.compose}>
        <Textarea
          className={styles.input}
          value={draft}
          placeholder={
            turns.length === 0 ? 'What do you want to know?' : 'Ask another'
          }
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
