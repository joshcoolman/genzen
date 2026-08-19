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
 * Pick one image out of the library.
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
  onPick,
  onClear,
  onOpen,
  disabled,
}: {
  images: Array<UserImage>
  imageUrls: Record<string, string>
  isLoading: boolean
  picked: Array<PickedImage>
  onPick: (picked: Array<PickedImage>) => void
  onClear: () => void
  onOpen: () => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className={styles.wrap}>
      <RefImageStrip
        images={picked}
        max={1}
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
        onConfirm={(selected) =>
          onPick(
            selected
              .slice(0, 1)
              .map((s) => ({ id: s.id, url: s.url, title: s.title })),
          )
        }
        max={1}
        autoConfirm
      />
    </div>
  )
}
