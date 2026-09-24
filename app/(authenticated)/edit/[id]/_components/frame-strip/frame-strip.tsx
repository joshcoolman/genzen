'use client'

import Link from 'next/link'
import { X } from 'lucide-react'
import styles from './frame-strip.module.css'
import type { EditFrame } from '../../../_lib/types'
import { imageUrl } from '#/lib/image-url'
import { ImageBox } from '#/components'

const SIZE = 96

/**
 * The frames saved out of this edit (#729), newest first.
 *
 * These are the live rows of the edit's image group, which is also what the
 * group's view on Images draws -- so trashing here and trashing there are the
 * same write to the same row, and nothing has to be kept in step. The link
 * opens that view.
 */
export function FrameStrip({
  frames,
  groupId,
  onTrash,
}: {
  frames: Array<EditFrame>
  groupId: string | null
  onTrash: (id: string) => void
}) {
  return (
    <div className={styles.strip}>
      <div className={styles.head}>
        <span>Frames{frames.length > 0 ? ` · ${frames.length}` : ''}</span>
        {groupId && (
          <Link href={`/images?group=${groupId}`}>Open in Images</Link>
        )}
      </div>
      {frames.length === 0 ? (
        <p className={styles.empty}>
          Pause on a frame and press F to save it here, and to a group named
          after this edit on Images.
        </p>
      ) : (
        <div className={styles.row}>
          {frames.map((frame) => (
            <div key={frame.id} className={styles.frame} title={frame.title}>
              <ImageBox
                src={imageUrl(frame.id, 'thumb')}
                alt={frame.title}
                size={SIZE}
                fit="contain"
                pad={0}
              />
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
          ))}
        </div>
      )}
    </div>
  )
}
