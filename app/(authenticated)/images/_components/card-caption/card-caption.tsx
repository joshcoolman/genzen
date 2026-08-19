'use client'

import { Redo } from 'lucide-react'
import styles from './card-caption.module.css'
import { CopyText } from '#/components'

interface CardCaptionProps {
  /** The prompt, or an upload's description or filename. */
  text: string
  /** Cmd/Ctrl-click loads the text into the generator. Omitted where that
   *  gesture would mean something else, as in select mode. */
  onUsePrompt?: (text: string) => void
  /** Fill the panel with everything that produced this image -- prompt,
   *  reference images, aspect ratio (#382). Same gate as `detailId`: a
   *  generation only, and never while a selection is running. */
  onLoad?: () => void
  /** The row's id, when this card is a generation with a record in Activity.
   *  Absent on an upload, which has no run to show, and in select mode, where
   *  every click belongs to the selection. */
  detailId?: string
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
 *
 * `detailId` is the one thing that legitimately differs between the two
 * states: a pending card does not get the link, because until its submit
 * answers its id is an optimistic placeholder with no row behind it, and a
 * link to nothing is worse than a link that arrives a moment late. That does
 * not reopen #367 -- the text is identical throughout, and the link appears at
 * the same moment `PendingImageCard` gives way to `ImageCard`, which is a real
 * change of component rather than a caption drifting under you.
 */
export function CardCaption({
  text,
  onUsePrompt,
  onLoad,
  detailId,
}: CardCaptionProps) {
  return (
    <div className={styles.caption}>
      {/* `silent`: the card teaches nothing on hover. Both gestures still work;
          naming them is `/account/shortcuts`' job, a surface that can carry the
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

      {/* The whole record -- prompt, the images it was given, cost, raw
          metadata -- rather than a lossy copy of some of it on the card
          (#380). A card that tried to show its inputs inline would be a third
          click target competing with open-the-viewer and Cmd-click-stage; a
          text link is unambiguously a link, and costs the tile no geometry.

          New tab on purpose. Looking up how you got here is a detour, not a
          destination: close the tab and the grid is exactly as you left it,
          scroll position and all. `stopPropagation` because the card's own
          click would otherwise open the viewer on the way out. */}
      {(detailId || onLoad) && (
        <div className={styles.actions}>
          {detailId ? (
            <a
              href={`/activity?entry=${detailId}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.details}
              onClick={(e) => e.stopPropagation()}
            >
              Details
            </a>
          ) : (
            <span />
          )}

          {/* Across from Details, and an icon rather than a word because the
              two are different kinds of thing: Details goes somewhere, Load
              acts on the panel you are already in. It is not Retry (which
              resubmits this row) and not a variation (which rewrites the
              prompt); it creates nothing and touches no row -- it fills a
              form, and leaves the model selection alone (#382).

              `title` rather than a `Tooltip`: the grid mounts one of these per
              card, and a provider around the wall to teach one word is the
              wrong trade. The name is on `aria-label` regardless. */}
          {onLoad && (
            <button
              type="button"
              className={styles.load}
              aria-label="Load into the generator"
              title="Load into the generator"
              onClick={(e) => {
                e.stopPropagation()
                onLoad()
              }}
            >
              <Redo size={13} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
