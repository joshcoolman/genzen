'use client'

import styles from './masonry.module.css'
import type { SavedAiImage } from '#/features/ai-images/types'

interface MasonryProps {
  images: Array<SavedAiImage>
  thumbnailUrls: Record<string, string>
  onOpen: (img: SavedAiImage) => void
}

/**
 * The browsing grid: images at their own aspect ratios, packed into columns.
 *
 * Nothing else is on the tile -- no caption, no model name, no hover actions.
 * A card with controls on it is a thing to work with; this is a thing to look
 * at, and the whole reason Explore exists is that those are different moods.
 *
 * CSS columns rather than a JS masonry: no measuring, no layout pass, no
 * reflow on resize. The cost is reading order -- items fill down each column
 * and then across, not left-to-right in rows -- which is the right trade for a
 * surface with no order worth following.
 */
export function Masonry({ images, thumbnailUrls, onOpen }: MasonryProps) {
  return (
    <div className={styles.masonry}>
      {images.map((img) => (
        <button
          key={img.id}
          className={styles.tile}
          onClick={() => onOpen(img)}
          aria-label={img.title}
        >
          <img
            src={thumbnailUrls[img.id]}
            alt={img.title}
            className={styles.image}
            loading="lazy"
          />
        </button>
      ))}
    </div>
  )
}
