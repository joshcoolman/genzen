'use client'

import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { enhanceDirection } from '../../_actions/enhance.action'
import { DURATIONS, PROMPT_LIMIT } from '../../clips'
import styles from './section-editor.module.css'
import type { Settings } from '../../clips'
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Textarea,
} from '#/components'

/**
 * Regenerating one section. The two stills are the seams it has to meet: the
 * frame it starts on, and -- when a later section exists -- the frame that
 * section opens on, which the new clip is pinned to so the join survives.
 * A final section has only the first, and is free to end anywhere.
 */
export function SectionEditor({
  open,
  sessionId,
  index,
  number,
  prompt,
  duration,
  startFrame,
  endFrame,
  busy,
  onGenerate,
  onCancel,
}: {
  open: boolean
  sessionId: string
  index: number
  number: number
  prompt: string
  duration: Settings['duration']
  startFrame: string | null
  endFrame: string | null
  busy: boolean
  onGenerate: (prompt: string, duration: Settings['duration']) => void
  onCancel: () => void
}) {
  const [text, setText] = useState(prompt)
  const [seconds, setSeconds] = useState(duration)
  const [enhancing, setEnhancing] = useState(false)
  const [fit, setFit] = useState('')
  const [failure, setFailure] = useState('')
  useEffect(() => {
    if (open) {
      setText(prompt)
      setSeconds(duration)
      setFit('')
      setFailure('')
    }
  }, [open, prompt, duration])
  // Enhance writes into the box rather than generating: it can only be judged
  // by reading it, and it costs nothing to throw away.
  async function enhance() {
    if (!trimmed || enhancing) return
    setEnhancing(true)
    setFailure('')
    try {
      const result = await enhanceDirection(sessionId, index, trimmed, seconds)
      setText(result.direction)
      setFit(result.fit)
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : 'The rewrite failed.')
    } finally {
      setEnhancing(false)
    }
  }
  const trimmed = text.trim()
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel()
      }}
    >
      <DialogContent className={styles.content}>
        <DialogHeader>
          <DialogTitle>Section {number}</DialogTitle>
        </DialogHeader>
        <div className={styles.frames}>
          <figure>
            {startFrame ? (
              <img src={startFrame} alt="" />
            ) : (
              <div className={styles.blank}>No opening frame</div>
            )}
            <figcaption>Starts on</figcaption>
          </figure>
          {endFrame && (
            <figure>
              <img src={endFrame} alt="" />
              <figcaption>Ends on</figcaption>
            </figure>
          )}
        </div>
        <label className={styles.field} htmlFor="director-section-prompt">
          {endFrame
            ? 'Describe the action between these frames'
            : 'Describe what happens from this frame'}
        </label>
        <Textarea
          id="director-section-prompt"
          autoFocus
          rows={4}
          value={text}
          maxLength={PROMPT_LIMIT}
          onChange={(event) => {
            setText(event.target.value)
            setFit('')
          }}
        />
        {!!fit && <p className={styles.fit}>{fit}</p>}
        {!!failure && (
          <p role="alert" className={styles.failure}>
            {failure}
          </p>
        )}
        <DialogFooter className={styles.footer}>
          <select
            aria-label="Clip duration"
            value={seconds}
            onChange={(event) =>
              setSeconds(Number(event.target.value) as Settings['duration'])
            }
          >
            {DURATIONS.map((value) => (
              <option key={value} value={value}>
                {value}s
              </option>
            ))}
          </select>
          <Button
            disabled={!trimmed || enhancing || busy}
            loading={enhancing}
            onClick={() => void enhance()}
            title="Rewrite this direction for the video model, using these frames and the duration"
          >
            <Sparkles size={16} />
            Enhance
          </Button>
          <Button onClick={onCancel}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!trimmed || busy}
            loading={busy}
            onClick={() => onGenerate(trimmed, seconds)}
          >
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
