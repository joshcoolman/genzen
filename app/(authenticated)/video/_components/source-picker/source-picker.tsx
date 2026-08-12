'use client'

import styles from './source-picker.module.css'
import type { VideoSource } from '../../use-view'
import { imageUrl } from '#/lib/image-url'
import { cx } from '#/lib/utils'

/**
 * The first frame, picked from the library.
 *
 * A strip rather than a dialog: image-to-video means the route is never a blank
 * page, and the source is the one input you cannot type.
 */
export function SourcePicker({
  sources,
  selectedId,
  onSelect,
}: {
  sources: Array<VideoSource>
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  if (sources.length === 0) {
    return (
      <p className={styles.empty}>
        No images yet. Generate one first — a clip starts from a still.
      </p>
    )
  }

  return (
    <div className={styles.strip}>
      {sources.map((source) => (
        <button
          key={source.id}
          type="button"
          className={cx(
            styles.item,
            source.id === selectedId && styles.selected,
          )}
          aria-pressed={source.id === selectedId}
          title={source.title}
          onClick={() => onSelect(source.id)}
        >
          <img src={imageUrl(source.id, 'thumb')} alt={source.title} />
        </button>
      ))}
    </div>
  )
}
