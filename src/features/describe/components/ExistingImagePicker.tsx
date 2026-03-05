import { useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import type { CollectedImage, UserImage } from '../types'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ActionButton } from '@/components/ActionButton'
import { ImageCard } from '@/components/ImageCard'
import { ImageGrid } from '@/components/ImageGrid'

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
}: ExistingImagePickerProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')

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
    () => filteredImages.filter((img) => alreadyCollectedIds.has(img.id)),
    [filteredImages, alreadyCollectedIds],
  )

  const availableImages = useMemo(
    () => filteredImages.filter((img) => !alreadyCollectedIds.has(img.id)),
    [filteredImages, alreadyCollectedIds],
  )

  const toggleSelect = (id: string) => {
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
      <DialogContent
        className="flex flex-col"
        style={{ width: '66vw', maxWidth: '66vw', maxHeight: '80vh' }}
      >
        <DialogHeader>
          <DialogTitle>Select from Library</DialogTitle>
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
              No images found
            </div>
          ) : (
            <>
              {alreadyCollectedImages.length > 0 && (
                <>
                  <div className="mb-2">
                    <p className="text-xs text-muted-foreground mb-2">
                      Already collected
                    </p>
                    <ImageGrid size="md">
                      {alreadyCollectedImages.map((image) => (
                        <ImageCard
                          key={image.id}
                          src={imageUrls[image.id] ?? null}
                          alt={image.title}
                          onClick={() => {}}
                          compact
                        />
                      ))}
                    </ImageGrid>
                  </div>
                  <hr className="border-border my-3" />
                </>
              )}
              <ImageGrid size="md">
                {availableImages.map((image) => {
                  const isSelected = selectedIds.has(image.id)

                  return (
                    <ImageCard
                      key={image.id}
                      src={imageUrls[image.id] ?? null}
                      alt={image.title}
                      onClick={() => toggleSelect(image.id)}
                      compact
                      hoverBorder={
                        isSelected
                          ? 'border-accent-brand'
                          : 'hover:border-accent-brand/50'
                      }
                    >
                      {isSelected && (
                        <div className="absolute top-1 right-1 rounded-full bg-accent-brand p-0.5">
                          <Check className="size-3 text-black" />
                        </div>
                      )}
                    </ImageCard>
                  )
                })}
              </ImageGrid>
            </>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t border-border pt-4">
          <div className="flex items-center gap-3">
            {max !== undefined && (
              <span className="text-xs text-muted-foreground">
                {selectedIds.size}/{max} selected
              </span>
            )}
            <ActionButton
              onClick={handleConfirm}
              disabled={selectedIds.size === 0}
            >
              Add {selectedIds.size > 0 ? `${selectedIds.size} ` : ''}Selected
            </ActionButton>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
