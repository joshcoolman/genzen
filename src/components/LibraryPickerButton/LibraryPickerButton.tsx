import { useCallback, useMemo, useState } from 'react'
import { BookOpen, Check, ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ImageCard } from '@/components/ImageCard'
import { ImageGrid } from '@/components/ImageGrid'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type SourceFilter = 'all' | 'upload' | 'ai_generated'

export interface SelectedImage {
  id: string
  url: string
  title: string
}

interface UserImageRow {
  id: string
  title: string
  source: string
  storage_path: string
  [key: string]: unknown
}

interface LibraryPickerButtonProps {
  images: Array<UserImageRow>
  imageUrls: Record<string, string>
  isLoading: boolean
  onSelect: (image: SelectedImage) => void
  onSelectMultiple?: (images: Array<SelectedImage>) => void
  multiple?: boolean
  onOpen?: () => void
  className?: string
}

export function LibraryPickerButton({
  images,
  imageUrls,
  isLoading,
  onSelect,
  onSelectMultiple,
  multiple = false,
  onOpen,
  className,
}: LibraryPickerButtonProps) {
  const [open, setOpen] = useState(false)
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const filteredImages = useMemo(() => {
    if (sourceFilter === 'all') return images
    return images.filter((img) => img.source === sourceFilter)
  }, [images, sourceFilter])

  const handleOpen = useCallback(() => {
    onOpen?.()
    setSelectedIds(new Set())
    setOpen(true)
  }, [onOpen])

  const handleSingleSelect = useCallback(
    (image: UserImageRow) => {
      const url = imageUrls[image.id]
      if (!url) return
      onSelect({ id: image.id, url, title: image.title })
      setOpen(false)
    },
    [imageUrls, onSelect],
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
        url: imageUrls[img.id] ?? '',
        title: img.title,
      }))
      .filter((img) => img.url)

    if (onSelectMultiple) {
      onSelectMultiple(selected)
    } else {
      selected.forEach((img) => onSelect(img))
    }
    setSelectedIds(new Set())
    setOpen(false)
  }, [images, imageUrls, selectedIds, onSelect, onSelectMultiple])

  const filterButtons: Array<{ value: SourceFilter; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'upload', label: 'Uploads' },
    { value: 'ai_generated', label: 'AI Generated' },
  ]

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className={className}
        onClick={handleOpen}
      >
        <BookOpen />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
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
                    <ImageCard
                      key={image.id}
                      src={imageUrls[image.id] ?? null}
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
                    >
                      {multiple && (
                        <div
                          className={`absolute top-2 right-2 size-5 rounded border flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'bg-accent-brand border-accent-brand text-black'
                              : 'bg-background/80 border-border'
                          }`}
                        >
                          {isSelected && <Check className="size-3" />}
                        </div>
                      )}
                    </ImageCard>
                  )
                })}
              </ImageGrid>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
