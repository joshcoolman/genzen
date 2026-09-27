'use client'

import styles from './cut-dialog.module.css'
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Textarea,
} from '#/components'

export function CutDialog({
  open,
  direction,
  busy,
  onOpenChange,
  onDirectionChange,
  onSubmit,
}: {
  open: boolean
  direction: string
  busy: boolean
  onOpenChange: (open: boolean) => void
  onDirectionChange: (value: string) => void
  onSubmit: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.content}>
        <DialogHeader>
          <DialogTitle>New cut from script</DialogTitle>
        </DialogHeader>
        <label htmlFor="cut-direction">
          Direction <span className={styles.hint}>(optional)</span>
        </label>
        <Textarea
          id="cut-direction"
          value={direction}
          maxLength={4000}
          rows={4}
          disabled={busy}
          onChange={(event) => onDirectionChange(event.target.value)}
          placeholder="Make it an animated film. Cut between the characters, with a slow-motion reveal when the genie appears."
          aria-describedby="cut-direction-hint"
        />
        <p id="cut-direction-hint" className={styles.hint}>
          Change the look, tone, pacing or camera. The story and dialogue stay
          intact. Leave blank to follow the original.
        </p>
        <div className={styles.actions}>
          <Button onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} onClick={onSubmit}>
            Create cut
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
