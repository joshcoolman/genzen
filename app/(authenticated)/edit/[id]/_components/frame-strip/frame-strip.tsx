'use client'

import Link from 'next/link'
import { Check, Loader, Sparkles, X } from 'lucide-react'
import styles from './frame-strip.module.css'
import type { EditFrame } from '../../../_lib/types'
import { imageUrl } from '#/lib/image-url'
import { cx } from '#/lib/utils'
import { Button, ImageBox } from '#/components'

const SIZE = 96

/**
 * The frames saved out of this edit (#729), newest first.
 *
 * These are the live rows of the edit's image group, which is also what the
 * group's view on Images draws -- so trashing here and trashing there are the
 * same write to the same row, and nothing has to be kept in step. The link
 * opens that view.
 *
 * A click toggles a frame into the selection, ring plus tick as Images does
 * (#733); with one or more selected, Generate frame appears with the count.
 * A frame being generated holds its place as a placeholder until the poll
 * settles it.
 */
export function FrameStrip({
  frames,
  groupId,
  selected,
  onToggle,
  onGenerate,
  onTrash,
}: {
  frames: Array<EditFrame>
  groupId: string | null
  selected: Set<string>
  onToggle: (id: string) => void
  onGenerate: () => void
  onTrash: (id: string) => void
}) {
  return (
    <div className={styles.strip}>
      <div className={styles.head}>
        <span>Frames{frames.length > 0 ? ` · ${frames.length}` : ''}</span>
        {selected.size > 0 && (
          <Button
            size="sm"
            onClick={onGenerate}
            title="Make a new frame from the selected ones"
          >
            <Sparkles size={14} />
            Generate frame · {selected.size}
          </Button>
        )}
        {groupId && (
          <Link className={styles.open} href={`/images?group=${groupId}`}>
            Open in Images
          </Link>
        )}
      </div>
      {frames.length === 0 ? (
        <p className={styles.empty}>
          Pause on a frame and press F to save it here, and to a group named
          after this edit on Images.
        </p>
      ) : (
        <div className={styles.row}>
          {frames.map((frame) => {
            const on = selected.has(frame.id)
            const pending = frame.status === 'pending'
            return (
              <div
                key={frame.id}
                className={cx(styles.frame, on && styles.frameOn)}
                title={frame.title}
              >
                {pending ? (
                  <div
                    className={styles.pending}
                    style={{ width: SIZE, height: SIZE }}
                    aria-label={`Making ${frame.title}`}
                  >
                    <Loader size={14} />
                  </div>
                ) : (
                  <button
                    type="button"
                    className={styles.pick}
                    onClick={() => onToggle(frame.id)}
                    aria-pressed={on}
                    aria-label={
                      on ? 'Deselect this frame' : 'Select this frame'
                    }
                  >
                    <ImageBox
                      src={imageUrl(frame.id, 'thumb')}
                      alt={frame.title}
                      size={SIZE}
                      fit="contain"
                      pad={0}
                    />
                    <span className={styles.tick} aria-hidden>
                      {on && <Check size={12} />}
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  className={styles.trash}
                  onClick={() => onTrash(frame.id)}
                  aria-label="Trash this frame"
                  title="Trash this frame"
                >
                  <X size={12} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
