'use client'

import { useCallback, useMemo, useState } from 'react'
import { Check, ImageIcon } from 'lucide-react'
import type { SelectedImage } from './LibraryPickerButton'
import { Button } from '#/components/ui/button'
import { Thumbnail } from '#/components/Thumbnail'
import { ImageGrid } from '#/components/ImageGrid'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'

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
      <DialogContent
        className="flex flex-col"
        style={{ width: '66vw', maxWidth: '66vw', maxHeight: '80vh' }}
      >
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Library</DialogTitle>
            {multiple && selectedIds.size > 0 && (
              <Button size="sm" onClick={handleConfirmMultiple}>
                Add {selectedIds.size} image
                {selectedIds.size !== 1 ? 's' : ''}
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="flex gap-2">
          {filterButtons.map((btn) => (
            <button
              key={btn.value}
              onClick={() => setSourceFilter(btn.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                sourceFilter === btn.value
                  ? 'bg-accent-brand text-black'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 pr-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              Loading images...
            </div>
          ) : filteredImages.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              <div className="text-center space-y-2">
                <ImageIcon className="size-8 mx-auto opacity-50" />
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
                          className={`absolute top-2 right-2 size-5 rounded border flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'bg-accent-brand border-accent-brand text-black'
                              : 'bg-background/80 border-border'
                          }`}
                        >
                          {isSelected && <Check className="size-3" />}
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
