'use client'

import { useEffect, useMemo, useState } from 'react'
import styles from './group-picker-dialog.module.css'
import type { SavedAiImage } from '#/features/ai-images/types'
import type { EditChildrenMap } from '#/features/ai-images/hooks/use-edit-children'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  ImageGrid,
  Thumbnail,
} from '#/components'
import { Button } from '#/components/button/button'

interface GroupPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedImages: Array<SavedAiImage>
  imageUrls: Record<string, string>
  editChildrenMap: EditChildrenMap
  loading: boolean
  onConfirm: (primaryId: string) => void
}

export function GroupPickerDialog({
  open,
  onOpenChange,
  selectedImages,
  imageUrls,
  editChildrenMap,
  loading,
  onConfirm,
}: GroupPickerDialogProps) {
  // Flatten: selected images + all their children
  const allImages = useMemo(() => {
    const seen = new Set<string>()
    const result: Array<{ id: string; url: string | undefined }> = []

    for (const img of selectedImages) {
      if (!seen.has(img.id)) {
        seen.add(img.id)
        result.push({ id: img.id, url: imageUrls[img.id] })
      }
      // Add children of this image
      const children = editChildrenMap[img.id] as
        | EditChildrenMap[string]
        | undefined
      if (children) {
        for (const child of children) {
          if (!seen.has(child.id)) {
            seen.add(child.id)
            result.push({ id: child.id, url: child.url })
          }
        }
      }
    }

    return result
  }, [selectedImages, imageUrls, editChildrenMap])

  const [primaryId, setPrimaryId] = useState<string>('')

  // Reset primary to first image when dialog opens
  useEffect(() => {
    if (open && allImages.length > 0) {
      setPrimaryId(allImages[0].id)
    }
  }, [open, allImages])

  // Enter key confirms
  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Enter' && primaryId && !loading) {
        e.preventDefault()
        onConfirm(primaryId)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, primaryId, loading, onConfirm])

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setPrimaryId('')
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={styles.popup}>
        <DialogHeader>
          <DialogTitle>Select Primary Image</DialogTitle>
        </DialogHeader>

        <div className={styles.actions}>
          <Button
            variant="secondary"
            onClick={() => handleOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => onConfirm(primaryId)}
            loading={loading}
            disabled={!primaryId}
          >
            {loading ? 'Grouping...' : 'Create Group'}
          </Button>
        </div>

        {allImages.length === 0 ? (
          <p className={styles.empty}>No images to group</p>
        ) : (
          <ImageGrid size="sm">
            {allImages.map((item) => (
              <Thumbnail
                key={item.id}
                url={item.url}
                alt=""
                status="complete"
                compact
                selected={primaryId === item.id}
                selectedClassName={styles.thumbSelected}
                objectFit="cover"
                className={
                  primaryId !== item.id ? styles.thumbDimmed : undefined
                }
                onClick={() => {
                  if (!loading) setPrimaryId(item.id)
                }}
              />
            ))}
          </ImageGrid>
        )}
      </DialogContent>
    </Dialog>
  )
}
