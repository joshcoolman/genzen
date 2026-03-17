import { useMemo, useState } from 'react'
import type { SavedAiImage } from '@/features/ai-images/types'
import type { EditChildrenMap } from '@/features/ai-images/hooks/use-edit-children'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ActionButton } from '@/components/ActionButton'
import { ImageGrid } from '@/components/ImageGrid'
import { Thumbnail } from '@/components/Thumbnail'

interface ParentPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  movingImage: SavedAiImage
  movingImageUrl: string | undefined
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
  images,
  imageUrls,
  editChildrenMap,
  loading,
  onConfirm,
}: ParentPickerDialogProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

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

  // Compute excluded IDs: the moving image + all its descendants
  const excludedIds = useMemo(() => {
    const excluded = new Set<string>([movingImage.id])

    // BFS through editChildrenMap to find all descendants of the moving image
    const queue = [movingImage.id]
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
  }, [movingImage.id, editChildrenMap])

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
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Move under...</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-3 rounded-md border border-border bg-muted/50 p-3">
          {movingImageUrl && (
            <img
              src={movingImageUrl}
              alt=""
              className="w-12 h-12 rounded object-cover"
            />
          )}
          <span className="text-sm text-muted-foreground">
            Select a new parent for this image
          </span>
        </div>

        {availableImages.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No available images to move under
          </p>
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
                onClick={() => setSelectedId(img.id)}
              />
            ))}
          </ImageGrid>
        )}

        <DialogFooter>
          <ActionButton
            onClick={() => selectedId && onConfirm(selectedId)}
            disabled={!selectedId}
            loading={loading}
            loadingText="Moving..."
          >
            Move here
          </ActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
