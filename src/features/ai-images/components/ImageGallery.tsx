import { useState } from 'react'
import type { SavedAiImage } from '@/features/ai-images/types'
import type { EditChildrenMap } from '@/features/ai-images/hooks/use-edit-children'
import { getModelName } from '@/features/ai-images/models'
import { PendingImageCard } from '@/features/ai-images/components/PendingImageCard'
import { ImageCard } from '@/features/ai-images/components/ImageCard'
import { FailedImageCard } from '@/features/ai-images/components/FailedImageCard'

const HIDE_PROMPTS_KEY = 'ai-images-hide-prompts'
const DISPLAY_MODE_KEY = 'ai-images-display-mode'

type DisplayMode = 'cover' | 'contain'

interface ImageGalleryProps {
  images: Array<SavedAiImage>
  imageUrls: Record<string, string>
  rootImageMeta: Record<string, { hidden: boolean }>
  editChildrenMap: EditChildrenMap
  loadingGallery: boolean
  generatingVariationFor: string | null
  onOpenLightbox: (img: SavedAiImage) => void
  onLoadPrompt: (img: SavedAiImage) => void
  onLoadPromptAndModel: (img: SavedAiImage) => void
  onMoreLikeThis: (img: SavedAiImage, count: number) => void
  onDelete: (img: SavedAiImage) => void
  onRestoreRoot: (rootId: string) => void
}

export function ImageGallery({
  images,
  imageUrls,
  rootImageMeta,
  editChildrenMap,
  loadingGallery,
  generatingVariationFor,
  onOpenLightbox,
  onMoreLikeThis,
  onDelete,
  onRestoreRoot,
}: ImageGalleryProps) {
  const [hidePrompts, setHidePrompts] = useState(() => {
    if (typeof window === 'undefined') return true
    const stored = localStorage.getItem(HIDE_PROMPTS_KEY)
    return stored === null ? true : stored === 'true'
  })

  const [displayMode, setDisplayMode] = useState<DisplayMode>(() => {
    if (typeof window === 'undefined') return 'contain'
    return (
      (localStorage.getItem(DISPLAY_MODE_KEY) as DisplayMode | null) ??
      'contain'
    )
  })

  const toggleHidePrompts = () => {
    setHidePrompts((prev) => {
      const next = !prev
      localStorage.setItem(HIDE_PROMPTS_KEY, String(next))
      return next
    })
  }

  const toggleDisplayMode = () => {
    setDisplayMode((prev) => {
      const next: DisplayMode = prev === 'cover' ? 'contain' : 'cover'
      localStorage.setItem(DISPLAY_MODE_KEY, next)
      return next
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Recent Generations</h2>
        {images.length > 0 && (
          <div className="flex items-center gap-3">
            <button
              onClick={toggleDisplayMode}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              {displayMode === 'cover' ? 'Full image' : 'Fill'}
            </button>
            <button
              onClick={toggleHidePrompts}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              {hidePrompts ? 'Show prompts' : 'Hide prompts'}
            </button>
          </div>
        )}
      </div>

      {loadingGallery ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : images.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border p-12 text-center">
          <h3 className="mb-2 text-lg font-semibold text-foreground">
            No saved images yet
          </h3>
          <p className="text-sm text-muted-foreground">
            Generate an image to see it here
          </p>
        </div>
      ) : (
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          }}
        >
          {images.map((img) => {
            const rootId =
              img.generation_metadata?.generation_type === 'variation'
                ? (img.generation_metadata.root_image_id ??
                  img.generation_metadata.source_image_id ??
                  '')
                : ''
            const rootMeta = rootId ? rootImageMeta[rootId] : undefined

            if (img.status === 'pending') {
              return (
                <PendingImageCard
                  key={img.id}
                  prompt={img.generation_metadata?.prompt ?? ''}
                  model={getModelName(img.generation_metadata?.model ?? '')}
                  isVariation={
                    img.generation_metadata?.generation_type === 'variation'
                  }
                  sourceImageUrl={
                    img.generation_metadata?.source_image_id
                      ? imageUrls[img.generation_metadata.source_image_id]
                      : undefined
                  }
                />
              )
            }

            if (img.status === 'failed') {
              return (
                <FailedImageCard key={img.id} img={img} onDelete={onDelete} />
              )
            }

            return (
              <ImageCard
                key={img.id}
                img={img}
                imageUrl={imageUrls[img.id]}
                generatingVariation={generatingVariationFor === img.id}
                hidePrompts={hidePrompts}
                objectFit={displayMode}
                rootImageUrl={rootId ? imageUrls[rootId] : undefined}
                rootIsHidden={rootMeta?.hidden}
                editChildren={editChildrenMap[img.id]}
                onRestore={rootId ? () => onRestoreRoot(rootId) : undefined}
                onOpen={onOpenLightbox}
                onMoreLikeThis={onMoreLikeThis}
                onDelete={onDelete}
                getModelName={getModelName}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
