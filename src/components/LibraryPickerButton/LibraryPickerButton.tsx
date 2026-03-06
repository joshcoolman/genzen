import { useCallback, useMemo, useState } from 'react'
import { BookOpen, ImageIcon } from 'lucide-react'
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
  onOpen?: () => void
  className?: string
}

export function LibraryPickerButton({
  images,
  imageUrls,
  isLoading,
  onSelect,
  onOpen,
  className,
}: LibraryPickerButtonProps) {
  const [open, setOpen] = useState(false)
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')

  const filteredImages = useMemo(() => {
    if (sourceFilter === 'all') return images
    return images.filter((img) => img.source === sourceFilter)
  }, [images, sourceFilter])

  const handleOpen = useCallback(() => {
    onOpen?.()
    setOpen(true)
  }, [onOpen])

  const handleSelect = useCallback(
    (image: UserImageRow) => {
      const url = imageUrls[image.id]
      if (!url) return
      onSelect({ id: image.id, url, title: image.title })
      setOpen(false)
    },
    [imageUrls, onSelect],
  )

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
            <DialogTitle>Library</DialogTitle>
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
                {filteredImages.map((image) => (
                  <ImageCard
                    key={image.id}
                    src={imageUrls[image.id] ?? null}
                    alt={image.title}
                    onClick={() => handleSelect(image)}
                    compact
                  />
                ))}
              </ImageGrid>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
