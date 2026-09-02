'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Dices } from 'lucide-react'
import styles from './generate-prompt-dialog.module.css'
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  MiniButton,
  useReportError,
} from '#/components'
import { generatePrompt } from '#/features/ai-images/server/generate-prompt.action'
import { usePersistedState } from '#/lib/use-persisted-state'

/** The nudge outlives the dialog: it is the kind of thing you are into for a
 *  stretch of days, and retyping "cinematic sci-fi" every time is a tax on the
 *  feature's whole point. */
const GUIDANCE_KEY = 'genzen:generate-prompt-guidance'

interface GeneratePromptButtonProps {
  /** Adds one prompt to the list. The dialog stays open. */
  onAdd: (prompt: string) => void
  disabled?: boolean
}

/**
 * A prompt out of nothing, for the blank field.
 *
 * It sits in the list's header strip rather than on a prompt row, because it is
 * not about any one input -- you open it, work in it, and prompts land in the
 * list behind. Apply adds and **does not close**, so one sitting can fill a
 * stack; nothing is generated yet, so an unwanted row is just a row to delete.
 */
export function GeneratePromptButton({
  onAdd,
  disabled,
}: GeneratePromptButtonProps) {
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [added, setAdded] = useState(false)
  const reportError = useReportError()

  const [guidance, setGuidance, guidanceHydrated] = usePersistedState<string>(
    () => localStorage.getItem(GUIDANCE_KEY) ?? '',
    '',
  )

  // Or the empty fallback lands on top of the stored value on first mount.
  useEffect(() => {
    if (!guidanceHydrated) return
    localStorage.setItem(GUIDANCE_KEY, guidance)
  }, [guidance, guidanceHydrated])

  // Everything shown this sitting, so the next one pushes away from it rather
  // than circling one idea. A ref: it feeds the request and nothing renders
  // from it.
  const shown = useRef<Array<string>>([])

  const roll = useCallback(
    async (like?: string) => {
      setLoading(true)
      setAdded(false)
      try {
        const result = await generatePrompt({
          guidance,
          like,
          avoid: shown.current,
        })
        shown.current = [...shown.current, result.prompt]
        setPrompt(result.prompt)
      } catch (err) {
        // Surfaces a missing ANTHROPIC_API_KEY as its own dialog rather than a
        // generic toast -- the key is optional locally, so an empty one is the
        // likeliest reason this does nothing.
        reportError(err, 'Could not generate a prompt.')
      } finally {
        setLoading(false)
      }
    },
    [guidance, reportError],
  )

  /**
   * Paste seeds the result without calling anything.
   *
   * Bring a prompt in from somewhere else, then use "More like this" to work
   * outward from it. The point is that it costs no request: the pasted text is
   * a starting position, not a result, and asking the model to hand back what
   * you just gave it would be a round trip for nothing.
   *
   * Bubble phase with a `defaultPrevented` guard, so it sits underneath the
   * handlers that are already listening. Images claims the clipboard in the
   * capture phase when it holds one of our record ids (#213) -- an image ref
   * still becomes a reference image, and only what nobody else wanted lands
   * here.
   */
  useEffect(() => {
    if (!open) return

    function onPaste(e: ClipboardEvent) {
      if (e.defaultPrevented) return
      // A typing surface keeps its own paste -- the guidance field being the
      // one that matters, since pasting a direction into it is ordinary.
      const target = e.target as HTMLElement | null
      if (target?.closest('input, textarea, [contenteditable="true"]')) return

      const text = e.clipboardData?.getData('text/plain').trim()
      if (!text) return

      e.preventDefault()
      // So the route's upload handler does not also take a run at it.
      e.stopPropagation()
      setPrompt(text)
      setAdded(false)
      // Not added to `shown`: that list is what to steer away from, and this
      // is the one thing the next roll is most likely meant to stay near.
    }

    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [open])

  // Deliberately does not fire on open. The dialog is a place to work, not a
  // slot machine that pulls itself -- and an immediate request would spend a
  // call before the guidance field has been read, let alone edited.
  function openDialog() {
    setPrompt('')
    setAdded(false)
    shown.current = []
    setOpen(true)
  }

  function apply() {
    onAdd(prompt)
    // The prompt stays on screen: it is still the seed for "More like this",
    // and clearing it would make Apply feel like it closed something. `added`
    // is what stops a second click adding a duplicate.
    setAdded(true)
  }

  return (
    <>
      <MiniButton
        icon={<Dices />}
        onClick={openDialog}
        disabled={disabled}
        title="Generate a prompt"
      >
        Generate prompt
      </MiniButton>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={styles.dialog}>
          <DialogHeader>
            <DialogTitle>Generate prompt</DialogTitle>
          </DialogHeader>

          {/* A fixed minimum, so the box does not resize between the three
              states and move the buttons out from under the pointer. */}
          <div className={styles.result}>
            {loading ? (
              <span className={styles.muted}>Thinking of something…</span>
            ) : prompt ? (
              <p className={styles.prompt}>{prompt}</p>
            ) : (
              <span className={styles.muted}>
                Click Generate prompt to get an idea, or paste one to start
                from.
              </span>
            )}
          </div>

          {/* A direction, not a specification. It persists because it is a mood
              you are in for a while; it is here rather than in system
              instructions because it steers only this, and system instructions
              go out with every generation. */}
          <Input
            value={guidance}
            onChange={(e) => setGuidance(e.target.value)}
            placeholder="Additional instructions (optional)"
            disabled={loading}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !loading) void roll()
            }}
          />

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={() => void roll()}
              disabled={loading}
            >
              Generate prompt
            </Button>
            {/* Only once there is something to be like. Before that it would be
                a button with no referent. */}
            {prompt && (
              <Button
                variant="secondary"
                onClick={() => void roll(prompt)}
                disabled={loading}
              >
                More like this
              </Button>
            )}
            <Button onClick={apply} disabled={loading || !prompt || added}>
              {added ? 'Added' : 'Apply'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
