'use client'

import styles from './card-caption.module.css'
import { CopyText } from '#/components'

interface CardCaptionProps {
  /** The prompt, or an upload's description or filename. */
  text: string
  /** Cmd/Ctrl-click loads the text into the generator. Omitted where that
   *  gesture would mean something else, as in select mode. */
  onUsePrompt?: (text: string) => void
}

/**
 * The block under a card's picture: the prompt, being its own copy button.
 *
 * **One component because it must not differ between states** (#367). A
 * generation's caption used to be written twice -- once in `ImageCard`, once in
 * `PendingImageCard` -- and the two drifted exactly as duplicated CSS does: the
 * pending copy was dimmer, at a different size, and not a copy button at all.
 * The text is the one thing on the card you read while waiting, so it changing
 * under you when the picture lands is the whole defect. Shared, they cannot.
 *
 * Three lines, no expand: the caption is there to jog your memory, not to be
 * read in full. The whole thing is one click away on the clipboard, and
 * Activity shows it entire. Unclamped (#284) a long prompt gave its card twice
 * the height of its neighbours, for text nobody read past the third line.
 */
export function CardCaption({ text, onUsePrompt }: CardCaptionProps) {
  return (
    <div className={styles.caption}>
      {/* `silent`: the card teaches nothing on hover. Both gestures still work;
          naming them is `/shortcuts`' job, a surface that can carry the
          explanation (#289). Only the "Copied" tick survives, because it
          reports rather than instructs. */}
      <CopyText
        text={text}
        label="Copy"
        silent
        onModifierClick={onUsePrompt}
        className={styles.prompt}
        textClassName={styles.promptText}
      />
    </div>
  )
}
