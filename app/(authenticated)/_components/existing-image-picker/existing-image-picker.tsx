'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import styles from './existing-image-picker.module.css'
import type { CollectedImage, UserImage } from '#/features/user-images/types'
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ImageGrid,
  Thumbnail,
} from '#/components'

type SourceFilter = 'all' | 'upload' | 'ai_generated'

interface ExistingImagePickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  images: Array<UserImage>
  imageUrls: Record<string, string>
  isLoading: boolean
  alreadyCollectedIds: Set<string>
  onConfirm: (images: Array<CollectedImage>) => void
  max?: number
  excludeIds?: Set<string>
  /** Pre-select these IDs when the picker opens. They appear as toggleable in the main grid (not in "already collected"). */
  initialSelectedIds?: Set<string>
  /** When true, immediately confirm after the first selection (useful for single-select pickers). */
  autoConfirm?: boolean
}

export function ExistingImagePicker({
  open,
  onOpenChange,
  images,
  imageUrls,
  isLoading,
  alreadyCollectedIds,
  onConfirm,
  max,
  excludeIds,
  initialSelectedIds,
  autoConfirm,
}: ExistingImagePickerProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')

  // When picker opens with initialSelectedIds, pre-check them
  useEffect(() => {
    if (open && initialSelectedIds?.size) {
      setSelectedIds(new Set(initialSelectedIds))
    } else if (!open) {
      setSelectedIds(new Set())
    }
  }, [open, initialSelectedIds])

  // When using initialSelectedIds, don't split into "already collected" section
  const effectiveCollectedIds = initialSelectedIds?.size
    ? new Set<string>()
    : alreadyCollectedIds

  const filteredImages = useMemo(() => {
    let result =
      sourceFilter === 'all'
        ? images
        : images.filter((img) => img.source === sourceFilter)
    if (excludeIds?.size)
      result = result.filter((img) => !excludeIds.has(img.id))
    return result
  }, [images, sourceFilter, excludeIds])

  const alreadyCollectedImages = useMemo(
    () => filteredImages.filter((img) => effectiveCollectedIds.has(img.id)),
    [filteredImages, effectiveCollectedIds],
  )

  const availableImages = useMemo(
    () => filteredImages.filter((img) => !effectiveCollectedIds.has(img.id)),
    [filteredImages, effectiveCollectedIds],
  )

  const toggleSelect = (id: string) => {
    if (autoConfirm) {
      const img = images.find((i) => i.id === id)
      if (img) {
        onConfirm([
          {
            id: img.id,
            title: img.title,
            url: imageUrls[img.id] ?? '',
            source: img.source,
            addedInSession: false,
          },
        ])
        setSelectedIds(new Set())
        onOpenChange(false)
      }
      return
    }
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        if (max !== undefined && next.size >= max) return prev
        next.add(id)
      }
      return next
    })
  }

  const handleConfirm = () => {
    const selected = images
      .filter((img) => selectedIds.has(img.id))
      .map(
        (img): CollectedImage => ({
          id: img.id,
          title: img.title,
          url: imageUrls[img.id] ?? '',
          source: img.source,
          addedInSession: false,
        }),
      )
    onConfirm(selected)
    setSelectedIds(new Set())
    onOpenChange(false)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSelectedIds(new Set())
    }
    onOpenChange(nextOpen)
  }

  const filterButtons: Array<{ value: SourceFilter; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'upload', label: 'Uploads' },
    { value: 'ai_generated', label: 'AI Generated' },
  ]

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="wide" className={styles.popup}>
        <DialogHeader>
          <DialogTitle>Library</DialogTitle>
        </DialogHeader>

        <div className={styles.filters}>
          {filterButtons.map((btn) => (
            <button
              key={btn.value}
              type="button"
              onClick={() => setSourceFilter(btn.value)}
              className={`${styles.filter} ${sourceFilter === btn.value ? styles.filterSelected : ''}`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        <div className={styles.grid}>
          {isLoading ? (
            <div className={styles.state}>Loading images...</div>
          ) : filteredImages.length === 0 ? (
            <div className={styles.state}>No images found</div>
          ) : (
            <>
              {alreadyCollectedImages.length > 0 && (
                <>
                  <div className={styles.collected}>
                    <p className={styles.collectedLabel}>Already collected</p>
                    <ImageGrid size="md">
                      {alreadyCollectedImages.map((image) => (
                        <Thumbnail
                          key={image.id}
                          url={imageUrls[image.id] ?? null}
                          alt={image.title}
                          compact
                        />
                      ))}
                    </ImageGrid>
                  </div>
                  <hr className={styles.divider} />
                </>
              )}
              <ImageGrid size="md">
                {availableImages.map((image) => {
                  const isSelected = selectedIds.has(image.id)

                  return (
                    <Thumbnail
                      key={image.id}
                      url={imageUrls[image.id] ?? null}
                      alt={image.title}
                      onClick={() => toggleSelect(image.id)}
                      compact
                      pickable
                      selected={isSelected}
                      selectedClassName={styles.thumbSelected}
                      imageOverlay={
                        isSelected ? (
                          <div className={styles.check}>
                            <Check />
                          </div>
                        ) : undefined
                      }
                    />
                  )
                })}
              </ImageGrid>
            </>
          )}
        </div>

        <DialogFooter className={styles.footer}>
          <div className={styles.footerInner}>
            {max !== undefined && (
              <span className={styles.count}>
                {selectedIds.size}/{max} selected
              </span>
            )}
            <Button
              variant="primary"
              onClick={handleConfirm}
              disabled={selectedIds.size === 0}
            >
              Add {selectedIds.size > 0 ? `${selectedIds.size} ` : ''}Selected
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
