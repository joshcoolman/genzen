import { Plus, X } from 'lucide-react'
import styles from './ref-image-strip.module.css'
import { cx } from '#/lib/utils'

interface RefImageStripProps {
  images: Array<{ id: string; url: string; title: string }>
  /**
   * Hard limit on the strip. Omit for an unbounded one, which is what the
   * generator panel is since #341: models take what they hold at submit and the
   * card reports it, so the strip has no number to enforce. Video keeps `max={1}`
   * -- that strip really is one image, not one image's worth of a model's
   * capacity.
   */
  max?: number
  onAdd?: () => void
  /** The whole thumbnail removes; the X is the label for it, not the target. */
  onRemove?: (id: string) => void
  /** Empties the strip in one click. Shown only once something is in it. */
  onClear?: () => void
  disabled?: boolean
  /** Show element label under each thumbnail */
  showLabels?: boolean
}

export function RefImageStrip({
  images,
  max,
  onAdd,
  onRemove,
  onClear,
  disabled,
  showLabels,
}: RefImageStripProps) {
  const removable = !!onRemove && !disabled

  return (
    <div className={cx(styles.root, showLabels && styles.rootLabelled)}>
      {images.map((img) => {
        const frame = (
          <>
            <img src={img.url} alt={img.title} className={styles.image} />
            {/* Revealed on hover, and not the target: aiming at a 12px corner
                is a lot of precision for "I do not want this one", and four red
                dots is a lot of alarm for a row you are mostly just looking at.
                The whole thumbnail takes the click; this says what it does. */}
            {removable && (
              <span className={styles.remove} aria-hidden="true">
                <X className={styles.removeIcon} />
              </span>
            )}
          </>
        )

        return (
          <div key={img.id} className={styles.item}>
            {removable ? (
              <button
                type="button"
                onClick={() => onRemove(img.id)}
                className={cx(styles.frame, styles.frameRemovable)}
                aria-label={`Remove ${img.title}`}
              >
                {frame}
              </button>
            ) : (
              <div className={styles.frame}>{frame}</div>
            )}
            {showLabels && <p className={styles.label}>{img.title}</p>}
          </div>
        )
      })}
      {(max === undefined || images.length < max) && onAdd && (
        <div className={styles.item}>
          <button
            type="button"
            onClick={onAdd}
            disabled={disabled}
            className={styles.add}
            aria-label="Add an image"
          >
            <Plus className={styles.addIcon} />
          </button>
          {showLabels && <p className={styles.addSpacer}>&nbsp;</p>}
        </div>
      )}
      <span className={styles.count}>
        {max === undefined ? images.length : `${images.length}/${max}`}
      </span>
      {/* Far right, so it is nowhere near the thumbnails it empties. Reads as
          the counter's twin rather than a button -- it is a way out of a state,
          not a step in the flow. */}
      {onClear && !disabled && images.length > 0 && (
        <button type="button" onClick={onClear} className={styles.clear}>
          Clear
        </button>
      )}
    </div>
  )
}
