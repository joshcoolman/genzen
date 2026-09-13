'use client'

import { useEffect, useState } from 'react'
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
  useEffect(() => {
    if (open) {
      setText(prompt)
      setSeconds(duration)
    }
  }, [open, prompt, duration])
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
          onChange={(event) => setText(event.target.value)}
        />
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
