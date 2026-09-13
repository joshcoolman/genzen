'use client'

import { useEffect, useState } from 'react'
import { Wand2 } from 'lucide-react'
import styles from './meta-prompt-dialog.module.css'
import type { RefImage } from '#/features/ai-images/hooks/use-generator'
import { writeMetaPrompts } from '#/features/ai-images/server/meta-prompt.action'
import {
  ActionButton,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  MiniButton,
  Textarea,
  useReportError,
} from '#/components'

interface MetaPromptButtonProps {
  /** The staged strip, in panel order. The button is not rendered without
   *  one, so this is never empty. */
  images: Array<RefImage>
  /** Adds the returned prompts to the list, in order. */
  onAdd: (prompts: Array<string>) => void
  disabled?: boolean
}

/**
 * Staged references plus a rough request, in one press (#645).
 *
 * **No review step.** The prompts land in the list and the dialog goes away.
 * They are rows like any other -- editable in place, deletable, and nothing is
 * generated yet -- so a confirm screen would be a second look at text you are
 * about to look at anyway, one click further from editing it.
 *
 * **One freeform field, and no settings.** Aspect ratio, model and count are
 * the panel's; what the tool writes is what is in the picture. A control here
 * would be a second place to decide something already decided six inches
 * below.
 *
 * **Several prompts come back from one call, which is the point.** Sheets
 * written one at a time drift apart; siblings written by one completion agree.
 * See `writeMetaPrompts`.
 */
export function MetaPromptButton({
  images,
  onAdd,
  disabled,
}: MetaPromptButtonProps) {
  const [open, setOpen] = useState(false)
  const [request, setRequest] = useState('')
  const [loading, setLoading] = useState(false)
  const reportError = useReportError()

  // Fresh each open. What you want out of these pictures is the question being
  // asked now, not a setting carried over from the last set.
  useEffect(() => {
    if (open) setRequest('')
  }, [open])

  async function submit() {
    if (!request.trim() || loading) return
    setLoading(true)
    try {
      const result = await writeMetaPrompts({
        imageIds: images.map((i) => i.id),
        request,
      })
      onAdd(result.prompts)
      setOpen(false)
    } catch (err) {
      // A missing ANTHROPIC_API_KEY gets its own dialog rather than a generic
      // toast -- the key is optional locally, so an empty one is the likeliest
      // reason this does nothing.
      reportError(err, 'Could not write prompts from these references.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <MiniButton
        icon={<Wand2 />}
        onClick={() => setOpen(true)}
        disabled={disabled}
        title="Write prompts from the staged references"
      >
        Meta prompt
      </MiniButton>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!loading) setOpen(next)
        }}
      >
        <DialogContent className={styles.content}>
          <DialogHeader>
            <DialogTitle>Meta prompt</DialogTitle>
            <DialogDescription>
              Say roughly what you want made from these pictures. What comes
              back fills the prompt list.
            </DialogDescription>
          </DialogHeader>

          {/* Shown, not selectable: the strip is the set, and a picture you
              did not want in it is one you remove from the panel rather than
              untick here. */}
          <div className={styles.strip}>
            {images.map((image) => (
              <span
                key={image.id}
                className={styles.thumb}
                style={{ backgroundImage: `url(${image.url})` }}
                title={image.title}
                aria-label={image.title}
                role="img"
              />
            ))}
          </div>

          <Textarea
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            rows={4}
            autoFocus
            disabled={loading}
            placeholder="A character sheet for the frog, one for the bear, and one for the environment..."
            onKeyDown={(e) => {
              // Enter is a newline here -- the request runs to a few lines and
              // naming three things on one is how it stops being readable.
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                void submit()
              }
            }}
          />

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <ActionButton
              onClick={() => void submit()}
              loading={loading}
              loadingText="Writing..."
              disabled={!request.trim()}
            >
              Write prompts
            </ActionButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
