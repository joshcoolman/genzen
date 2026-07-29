'use client'

import { useMemo, useState } from 'react'
import styles from './parent-picker-dialog.module.css'
import type { SavedAiImage } from '#/features/ai-images/types'
import type { EditChildrenMap } from '#/features/ai-images/hooks/use-edit-children'
import { ImageGrid, Thumbnail } from '#/components'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '#/components/dialog/dialog'

interface ParentPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  movingImage: SavedAiImage
  movingImageUrl: string | undefined
  /** When set, overrides single-image mode for batch move */
  movingImages?: Array<SavedAiImage>
  images: Array<SavedAiImage>
  imageUrls: Record<string, string>
  editChildrenMap: EditChildrenMap
  loading: boolean
  onConfirm: (newParentId: string) => void
}

export function ParentPickerDialog({
  open,
  onOpenChange,
  movingImage,
  movingImageUrl,
  movingImages,
  images,
  imageUrls,
  editChildrenMap,
  loading,
  onConfirm,
}: ParentPickerDialogProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const isBatch = movingImages && movingImages.length > 1

  // Collect all child IDs from the editChildrenMap (images nested under parents)
  const allChildIds = useMemo(
    () =>
      new Set(
        Object.values(editChildrenMap).flatMap((children) =>
          children.map((c) => c.id),
        ),
      ),
    [editChildrenMap],
  )

  // Compute excluded IDs: moving image(s) + all their descendants
  const excludedIds = useMemo(() => {
    const sourceIds = movingImages
      ? movingImages.map((img) => img.id)
      : [movingImage.id]
    const excluded = new Set<string>(sourceIds)

    // BFS through editChildrenMap to find all descendants
    const queue = [...sourceIds]
    while (queue.length > 0) {
      const current = queue.shift()!
      const children = editChildrenMap[current] as
        | EditChildrenMap[string]
        | undefined
      if (children) {
        for (const child of children) {
          if (!excluded.has(child.id)) {
            excluded.add(child.id)
            queue.push(child.id)
          }
        }
      }
    }

    return excluded
  }, [movingImage.id, movingImages, editChildrenMap])

  // Only show top-level images (not already children) and exclude self + descendants
  const availableImages = useMemo(
    () =>
      images.filter(
        (img) =>
          img.status === 'completed' &&
          !excludedIds.has(img.id) &&
          !allChildIds.has(img.id),
      ),
    [images, excludedIds, allChildIds],
  )

  // Reset selection when dialog closes
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setSelectedId(null)
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={styles.popup}>
        <DialogHeader>
          <DialogTitle>Move under...</DialogTitle>
        </DialogHeader>

        <div className={styles.banner}>
          {isBatch ? (
            <span className={styles.bannerText}>
              Select a new parent for {movingImages.length} images
            </span>
          ) : (
            <>
              {movingImageUrl && (
                <img
                  src={movingImageUrl}
                  alt=""
                  className={styles.bannerThumb}
                />
              )}
              <span className={styles.bannerText}>
                Select a new parent for this image
              </span>
            </>
          )}
        </div>

        {availableImages.length === 0 ? (
          <p className={styles.empty}>No available images to move under</p>
        ) : (
          <ImageGrid size="md">
            {availableImages.map((img) => (
              <Thumbnail
                key={img.id}
                url={imageUrls[img.id]}
                alt={img.title}
                status="complete"
                compact
                selected={selectedId === img.id}
                onClick={() => {
                  if (!loading) onConfirm(img.id)
                }}
              />
            ))}
          </ImageGrid>
        )}
      </DialogContent>
    </Dialog>
  )
}
