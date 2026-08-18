'use client'

import { ImageBox } from '../image-box/image-box'
import styles from './media-box.module.css'
import type { ImageBoxProps } from '../image-box/image-box'

export interface MediaBoxProps extends ImageBoxProps {
  /** `video` renders an mp4's first frame. Anything else is a picture. */
  kind?: 'image' | 'video'
}

/**
 * A square that shows a picture **or a clip's first frame**.
 *
 * The clip half is a `<video>` with no controls: there is no poster frame
 * anywhere in the app -- no ffmpeg on the server, so `thumbnail_path` is NULL
 * on every clip -- and an mp4 handed to an `<img>` lands on the broken-file
 * fallback, which makes every clip in a list look identical.
 *
 * **This exists because the decision had been made three times** (#398): the
 * Video route's card, Trash's row, and then Activity. It is a sibling of
 * `ImageBox` rather than a `kind` prop on it, deliberately -- that primitive's
 * contract is that it shows an image and nothing else, and the last thumbnail
 * component to grow one more capability reached thirty-one props.
 *
 * The Video route's own card is **not** this: a clip you are working with gets
 * native controls and a caption, which is a card, not a box.
 */
/**
 * A clip's URL, seeked far enough to paint.
 *
 * **`preload="metadata"` on its own paints nothing.** It was believed to since
 * #384 and the black squares went unnoticed in Trash for as long -- Chrome
 * fetches the header, learns the duration, and stops, leaving the element
 * empty. A media fragment makes it seek, and the seek is what decodes a frame.
 * 0.001s rather than 0 because a seek to exactly zero is a no-op.
 *
 * This works only because `/img/[id]` answers range requests (`parseRange` in
 * `src/lib/http-range.ts`). Without a 206 the browser refetches from byte zero
 * and gives up on the seek.
 */
export function firstFrameSrc(
  src: string | null | undefined,
): string | undefined {
  if (!src) return undefined
  return src.includes('#') ? src : `${src}#t=0.001`
}

export function MediaBox({ kind = 'image', ...props }: MediaBoxProps) {
  if (kind !== 'video') return <ImageBox {...props} />

  const { src, size, fit = 'contain', pad, className } = props
  const mat = pad ?? (fit === 'cover' ? 0 : 10)

  return (
    <div
      className={className ? `${styles.box} ${className}` : styles.box}
      style={
        {
          '--media-box-size': `${size}px`,
          '--media-box-pad': `${mat}px`,
        } as React.CSSProperties
      }
    >
      <video
        className={fit === 'cover' ? styles.clipCover : styles.clip}
        src={firstFrameSrc(src)}
        preload="metadata"
        muted
        playsInline
      />
    </div>
  )
}
