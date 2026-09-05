'use client'

import { useState } from 'react'
import { ExistingImagePicker } from '../../../_components/existing-image-picker/existing-image-picker'
import styles from './image-input.module.css'
import type { UserImage } from '#/features/user-images/types'
import { RefImageStrip } from '#/components'

export interface PickedImage {
  id: string
  url: string
  title: string
}

/**
 * Pick images out of the library.
 *
 * `RefImageStrip` plus `ExistingImagePicker`, both borrowed unmodified — the
 * same pair the video route uses for its frame slots. A lab experiment that
 * hand-rolls its own picker is not testing its own idea, and the lab may import
 * from the app freely (the reverse is what must never happen).
 */
export function ImageInput({
  images,
  imageUrls,
  isLoading,
  picked,
  max = 1,
  onPick,
  onClear,
  onOpen,
  onRefresh,
  disabled,
}: {
  images: Array<UserImage>
  imageUrls: Record<string, string>
  isLoading: boolean
  picked: Array<PickedImage>
  /**
   * How many images this experiment takes. One by default -- Describe asks a
   * question about a single picture. Variations passes more (#436), and the
   * rule Outpaint established before it shipped out of the lab (#441, #528)
   * still holds: where the settings are the settings and the images are the
   * input, there was never a reason for only one.
   */
  max?: number
  onPick: (picked: Array<PickedImage>) => void
  /** Drop one image, by id. */
  onClear: (id: string) => void
  onOpen: () => void
  /**
   * Re-read the library. Passing it turns on Upload inside the picker (#489),
   * which the lab had no way to reach: getting an image off disk meant leaving
   * for /images and coming back. Optional only because a page with no library
   * behind it yet has nothing to refresh.
   */
  onRefresh?: () => Promise<void>
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className={styles.wrap}>
      <RefImageStrip
        images={picked}
        max={max}
        onAdd={() => {
          onOpen()
          setOpen(true)
        }}
        onRemove={onClear}
        disabled={disabled}
      />
      <ExistingImagePicker
        open={open}
        onOpenChange={setOpen}
        images={images}
        imageUrls={imageUrls}
        isLoading={isLoading}
        alreadyCollectedIds={new Set(picked.map((p) => p.id))}
        /* Appends rather than replaces, so a second visit to the picker adds
           to what is already on the strip -- `alreadyCollectedIds` above is
           what stops the same image arriving twice. */
        onConfirm={(selected) =>
          onPick(
            selected
              .slice(0, max)
              .map((s) => ({ id: s.id, url: s.url, title: s.title })),
          )
        }
        max={max}
        onRefresh={onRefresh}
        /* One image confirms on the click; several need a Done, which is what
           the picker's footer already is. */
        autoConfirm={max === 1}
      />
    </div>
  )
}
