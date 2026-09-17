'use client'

import styles from './take-dialog.module.css'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '#/components'

/**
 * One take, played over the board (#697).
 *
 * **A popup rather than a player in the row.** Thirty-two rows each holding a
 * `<video>` is thirty-two elements decoding at once, and a board you scroll to
 * read is not a board you want playing at you. The row shows that a take
 * exists; watching it is a deliberate press.
 *
 * Native controls, one take at a time. There is no ping-ponging pair here and
 * no join to protect -- that is the run player's problem, and playing the board
 * end to end is its own question.
 */
export function TakeDialog({
  takeId,
  label,
  onOpenChange,
}: {
  takeId: string | null
  label: string
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={takeId !== null} onOpenChange={onOpenChange}>
      <DialogContent className={styles.content}>
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
        </DialogHeader>
        {takeId && (
          /* Keyed on the id so opening a second take loads it rather than
             leaving the first one's frames on screen. */
          <video
            key={takeId}
            className={styles.video}
            src={`/img/${takeId}`}
            controls
            autoPlay
            playsInline
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
