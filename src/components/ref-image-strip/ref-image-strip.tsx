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
  /** Derived, not a prop: the number matters exactly when a prompt could name
   *  it, and that is the same condition the submit prefix uses. A host opting
   *  out would be a strip whose numbers disagree with the prompt. */
  const numbered = images.length > 1

  return (
    <div className={cx(styles.root, showLabels && styles.rootLabelled)}>
      {images.map((img, index) => {
        const frame = (
          <>
            <img src={img.url} alt={img.title} className={styles.image} />
            {/* The number the prompt says out loud. `useGenerator` prepends
                `[Image 1, Image 2, ...]` at submit for exactly this set, so
                without it the strip and the prompt agree only by luck (#436).
                Hidden at one image, where the prefix does not apply either and
                a lone "1" is a badge for nothing. */}
            {numbered && (
              <span className={styles.ordinal} aria-hidden="true">
                {index + 1}
              </span>
            )}
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
          {/* Only beside something that actually has a label. On an empty
              strip there is nothing to line up with, and the reserved line
              was pure height in a box whose whole job is to be small. */}
          {showLabels && images.length > 0 && (
            <p className={styles.addSpacer}>&nbsp;</p>
          )}
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
