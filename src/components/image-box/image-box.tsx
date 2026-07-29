'use client'

import { Avatar } from '@base-ui/react/avatar'
import { ImageOff } from 'lucide-react'
import styles from './image-box.module.css'

export interface ImageBoxProps {
  /** Null while a URL is still being signed, or when the row has no file. Both
   *  land on the fallback -- to a viewer they are the same thing. */
  src: string | null | undefined
  alt: string
  /** The width. And the height: an ImageBox is always square. Rectangles are a
   *  different component, not a prop on this one. */
  size: number
  /** `contain` centres the whole image on the backing, letterboxed. `cover`
   *  fills the square and crops. */
  fit?: 'contain' | 'cover'
  /** The mat between the image and the edge of the square, in px. Defaults to
   *  10 under `contain`, where the letterboxing wants a margin to read as
   *  deliberate, and to 0 under `cover`, where there is nothing to mat. Pass 0
   *  for edge-to-edge either way. */
  pad?: number
  /** Escape hatch for position/margin at the call site. Never for size or fit. */
  className?: string
}

/**
 * A square that shows an image. Nothing else -- no click, no hover, no
 * overlay, no children.
 *
 * Built on Base UI's Avatar, which is the only primitive in the library that
 * owns an image's load-state machine: idle -> loading -> loaded | error, and
 * critically the case where the browser already has the file cached, where
 * `onLoad` never fires and a hand-rolled skeleton sticks forever. That was
 * twelve lines of `img.complete && naturalWidth > 0` we no longer maintain.
 *
 * It is named Avatar because that is its usual job. It is used here for a
 * content thumbnail, and the behaviour is the same either way.
 *
 * A component that needs controls composes them *around* this one. Every
 * attempt to add a capability here -- a badge, a delete button, a selected
 * ring -- is how the last thumbnail primitive reached thirty-one props.
 */
export function ImageBox({
  src,
  alt,
  size,
  fit = 'contain',
  pad,
  className,
}: ImageBoxProps) {
  const mat = pad ?? (fit === 'cover' ? 0 : 10)

  return (
    <Avatar.Root
      className={className ? `${styles.box} ${className}` : styles.box}
      style={
        {
          '--image-box-size': `${size}px`,
          '--image-box-pad': `${mat}px`,
        } as React.CSSProperties
      }
    >
      {src ? (
        <Avatar.Image
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          className={fit === 'cover' ? styles.imageCover : styles.image}
        />
      ) : null}
      <Avatar.Fallback delay={src ? 150 : 0} className={styles.fallback}>
        <ImageOff className={styles.fallbackIcon} />
      </Avatar.Fallback>
    </Avatar.Root>
  )
}
