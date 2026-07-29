'use client'

import { useCallback, useMemo, useState } from 'react'
import { Check, ImageIcon } from 'lucide-react'
import { Button } from '../button/button'
import { Thumbnail } from '../thumbnail/thumbnail'
import { ImageGrid } from '../image-grid/image-grid'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../dialog/dialog'
import styles from './library-picker-dialog.module.css'
import type { SelectedImage } from './library-picker-button'

type SourceFilter = 'all' | 'upload' | 'ai_generated'

interface UserImageRow {
  id: string
  title: string
  source: string
  storage_path: string | null
  [key: string]: unknown
}

interface LibraryPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  images: Array<UserImageRow>
  imageUrls: Record<string, string>
  originalUrls?: Record<string, string>
  isLoading: boolean
  onSelect: (image: SelectedImage) => void
  onSelectMultiple?: (images: Array<SelectedImage>) => void
  multiple?: boolean
}

export function LibraryPickerDialog({
  open,
  onOpenChange,
  images,
  imageUrls,
  originalUrls,
  isLoading,
  onSelect,
  onSelectMultiple,
  multiple = false,
}: LibraryPickerDialogProps) {
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const filteredImages = useMemo(() => {
    if (sourceFilter === 'all') return images
    return images.filter((img) => img.source === sourceFilter)
  }, [images, sourceFilter])

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) setSelectedIds(new Set())
      onOpenChange(nextOpen)
    },
    [onOpenChange],
  )

  const handleSingleSelect = useCallback(
    (image: UserImageRow) => {
      const url = (originalUrls ?? imageUrls)[image.id]
      if (!url) return
      onSelect({ id: image.id, url, title: image.title })
      onOpenChange(false)
    },
    [imageUrls, originalUrls, onSelect, onOpenChange],
  )

  const handleToggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleConfirmMultiple = useCallback(() => {
    const selected = images
      .filter((img) => selectedIds.has(img.id))
      .map((img) => ({
        id: img.id,
        url: (originalUrls ?? imageUrls)[img.id] ?? '',
        title: img.title,
      }))
      .filter((img) => img.url)

    if (onSelectMultiple) {
      onSelectMultiple(selected)
    } else {
      selected.forEach((img) => onSelect(img))
    }
    setSelectedIds(new Set())
    onOpenChange(false)
  }, [
    images,
    imageUrls,
    originalUrls,
    selectedIds,
    onSelect,
    onSelectMultiple,
    onOpenChange,
  ])

  const filterButtons: Array<{ value: SourceFilter; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'upload', label: 'Uploads' },
    { value: 'ai_generated', label: 'AI Generated' },
  ]

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="wide" className={styles.popup}>
        <DialogHeader>
          <div className={styles.headerRow}>
            <DialogTitle>Library</DialogTitle>
            {multiple && selectedIds.size > 0 && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleConfirmMultiple}
              >
                Add {selectedIds.size} image
                {selectedIds.size !== 1 ? 's' : ''}
              </Button>
            )}
          </div>
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
            <div className={styles.state}>
              <div className={styles.empty}>
                <ImageIcon className={styles.emptyIcon} />
                <p>No images in your library yet</p>
              </div>
            </div>
          ) : (
            <ImageGrid size="md">
              {filteredImages.map((image) => {
                const isSelected = selectedIds.has(image.id)
                return (
                  <Thumbnail
                    key={image.id}
                    url={imageUrls[image.id] ?? null}
                    alt={image.title}
                    onClick={() =>
                      multiple
                        ? handleToggle(image.id)
                        : handleSingleSelect(image)
                    }
                    compact
                    hoverBorder={
                      isSelected
                        ? 'border-accent-brand'
                        : 'hover:border-accent-brand/50'
                    }
                    imageOverlay={
                      multiple ? (
                        <div
                          className={`${styles.checkbox} ${isSelected ? styles.checkboxSelected : ''}`}
                        >
                          {isSelected && <Check />}
                        </div>
                      ) : undefined
                    }
                  />
                )
              })}
            </ImageGrid>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
