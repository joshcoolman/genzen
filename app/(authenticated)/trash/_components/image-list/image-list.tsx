'use client'

import { ImageRow } from '../image-row/image-row'
import type { UserImage } from '#/features/user-images/types'
import { EmptyState, ImageGrid } from '#/components'

interface ImageListProps {
  images: Array<UserImage>
  urls: Record<string, string>
  selectedIds: Set<string>
  hasSelection: boolean
  busyId: string | null
  onToggle: (id: string, shiftKey: boolean) => void
  onRestore: (id: string) => void
  onDelete: (id: string) => void
}

export function ImageList({
  images,
  urls,
  selectedIds,
  hasSelection,
  busyId,
  onToggle,
  onRestore,
  onDelete,
}: ImageListProps) {
  if (images.length === 0) {
    return (
      <EmptyState title="No deleted images yet">
        Images you delete land here, where you can restore them.
      </EmptyState>
    )
  }

  return (
    <ImageGrid layout="list" size="md">
      {images.map((image) => (
        <ImageRow
          key={image.id}
          image={image}
          url={urls[image.id] ?? null}
          selected={selectedIds.has(image.id)}
          hasSelection={hasSelection}
          busy={busyId === image.id}
          onToggle={onToggle}
          onRestore={onRestore}
          onDelete={onDelete}
        />
      ))}
    </ImageGrid>
  )
}
