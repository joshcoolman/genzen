'use client'

import styles from './script-dialog.module.css'
import {
  CopyButton,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Textarea,
} from '#/components'

/**
 * The run's prompts in one box, verbatim, to be copied out.
 *
 * Read-only: the prompts are the source, and a script edited here would be a
 * second copy of them that the run does not know about. Editing a line means
 * the pencil on its tile.
 */
export function ScriptDialog({
  open,
  onOpenChange,
  script,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  script: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.content}>
        <DialogHeader>
          <DialogTitle>Script</DialogTitle>
        </DialogHeader>
        <Textarea
          readOnly
          value={script}
          className={styles.text}
          aria-label="Script"
        />
        <div className={styles.actions}>
          <CopyButton text={script} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
