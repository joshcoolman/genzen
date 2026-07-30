'use client'

import { canRetryFailure } from '../canvas-generate-dialog/use-canvas-generate'
import styles from './image-card.module.css'
import type { CanvasImage } from '../../_lib/types'
import { cx } from '#/lib/utils'
import { getModelName } from '#/features/ai-images/models'

/** How far the failure text is allowed to counter-scale when zoomed out. */
const MAX_FAILED_TEXT_SCALE = 3

interface ImageCardProps {
  image: CanvasImage
  /** Inside a live multi-selection's bounding box but not selected. */
  dimmed: boolean
  /** Current zoom, so failure text stays readable when zoomed out. */
  scale: number
  onRetry: (id: string) => void
  onDismiss: (id: string, recordId: string | undefined) => void
}

/** One card on the canvas plane, in one of three states: pending placeholder,
 *  failed tile, or the image itself.
 *
 *  `data-image-id` is what the surface's pointer handlers hit-test against, so
 *  it has to stay on the outer element. */
export function ImageCard({
  image,
  dimmed,
  scale,
  onRetry,
  onDismiss,
}: ImageCardProps) {
  return (
    <div
      data-image-id={image.id}
      className={cx(
        styles.image,
        dimmed && styles.dimmed,
        image.pending && styles.pending,
        image.failed && styles.failed,
      )}
      style={{
        left: image.x,
        top: image.y,
        width: image.width,
        height: image.height,
      }}
    >
      {image.pending ? (
        <div className={styles.pendingInner} />
      ) : image.failed ? (
        <div className={styles.failedInner}>
          <div
            className={styles.failedContent}
            style={{
              transform: `scale(${Math.min(MAX_FAILED_TEXT_SCALE, 1 / scale)})`,
            }}
          >
            <span className={styles.failedModel}>
              {getModelName(image.model ?? '')}
            </span>
            <span className={styles.failedMsg}>
              {image.errorMessage ?? 'Generation failed'}
            </span>
            <div className={styles.failedActions}>
              {canRetryFailure(image) && (
                <button
                  type="button"
                  className={styles.failedBtn}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    onRetry(image.id)
                  }}
                >
                  Retry
                </button>
              )}
              <button
                type="button"
                className={styles.failedBtnGhost}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation()
                  onDismiss(image.id, image.recordId)
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      ) : (
        <img src={image.signedUrl} alt="" draggable={false} />
      )}
    </div>
  )
}
