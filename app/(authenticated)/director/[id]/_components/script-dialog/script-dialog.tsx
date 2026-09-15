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
 *
 * A chat's transcript is the same box under a different title (#670): the
 * conversation is stored and valuable, but it is not shown on the page --
 * it is opened on purpose, read, copied, closed.
 */
export function ScriptDialog({
  open,
  onOpenChange,
  script,
  title = 'Script',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  script: string
  title?: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.content}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Textarea
          readOnly
          value={script}
          className={styles.text}
          aria-label={title}
        />
        <div className={styles.actions}>
          <CopyButton text={script} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
