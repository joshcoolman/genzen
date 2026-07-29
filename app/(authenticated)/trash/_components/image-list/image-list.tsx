'use client'

import { Trash2 } from 'lucide-react'
import { ImageRow } from '../image-row/image-row'
import styles from './image-list.module.css'
import type { UserImage } from '#/features/user-images/types'
import { ImageGrid } from '#/components'

interface ImageListProps {
  images: Array<UserImage>
  urls: Record<string, string>
  selectedIds: Set<string>
  hasSelection: boolean
  busyId: string | null
  canvasLinkedIds: Set<string>
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
  canvasLinkedIds,
  onToggle,
  onRestore,
  onDelete,
}: ImageListProps) {
  if (images.length === 0) {
    return (
      <div className={styles.empty}>
        <Trash2 className={styles.emptyIcon} />
        <p>Trash is empty</p>
      </div>
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
          onCanvas={canvasLinkedIds.has(image.id)}
          onToggle={onToggle}
          onRestore={onRestore}
          onDelete={onDelete}
        />
      ))}
    </ImageGrid>
  )
}
