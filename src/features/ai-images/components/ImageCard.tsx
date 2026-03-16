import { useNavigate } from '@tanstack/react-router'
import type { SavedAiImage } from '@/features/ai-images/types'
import type { EditChildrenMap } from '@/features/ai-images/hooks/use-edit-children'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Thumbnail } from '@/components/Thumbnail'
import { CopyButton } from '@/components/CopyButton'

interface ImageCardProps {
  img: SavedAiImage
  imageUrl: string | undefined
  generatingVariation: boolean
  hidePrompts: boolean
  objectFit?: 'contain' | 'cover'
  rootImageUrl?: string
  rootIsHidden?: boolean
  editChildren?: EditChildrenMap[string]
  onRestore?: () => void
  onOpen: (img: SavedAiImage) => void
  onPreviewVariations: (img: SavedAiImage, count: number) => void
  onDelete: (img: SavedAiImage) => void
  getModelName: (id: string) => string
}

export function ImageCard({
  img,
  imageUrl,
  generatingVariation,
  hidePrompts,
  objectFit,
  rootImageUrl,
  rootIsHidden,
  editChildren,
  onRestore,
  onOpen,
  onPreviewVariations,
  onDelete,
  getModelName,
}: ImageCardProps) {
  const navigate = useNavigate()

  return (
    <Thumbnail
      url={imageUrl}
      alt={img.title}
      status="complete"
      objectFit={objectFit}
      label={
        img.generation_metadata
          ? getModelName(img.generation_metadata.model)
          : undefined
      }
      topLeftBadge={
        img.generation_metadata?.generation_type === 'variation'
          ? 'Variation'
          : undefined
      }
      onDelete={() => onDelete(img)}
      onClick={() => imageUrl && onOpen(img)}
    >
      <div className="flex gap-1 p-1.5">
        <MorePopover
          disabled={generatingVariation}
          onSelect={(count) => onPreviewVariations(img, count)}
        />
        <button
          onClick={() =>
            navigate({
              to: '/dashboard/edit/$imageId',
              params: { imageId: img.id },
            })
          }
          className="flex-1 rounded bg-muted px-2 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
        >
          Edit
        </button>
      </div>
      {!hidePrompts && (
        <div className="px-3 pb-3">
          <div className="relative">
            <div className="absolute top-0 right-0">
              <CopyButton
                text={
                  img.generation_metadata?.generation_type === 'variation' &&
                  img.generation_metadata.original_prompt
                    ? `${img.generation_metadata.original_prompt}\n\nVariation: ${img.generation_metadata.prompt}`
                    : (img.generation_metadata?.prompt ?? img.title)
                }
                iconSize="h-4 w-4"
              />
            </div>
            {img.generation_metadata?.generation_type === 'variation' &&
            img.generation_metadata.original_prompt ? (
              <div className="pr-6 space-y-1.5">
                <p className="text-xs text-muted-foreground">
                  {img.generation_metadata.original_prompt}
                </p>
                <p className="text-xs text-muted-foreground/60 italic">
                  Variation: {img.generation_metadata.prompt}
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground pr-6">
                {img.generation_metadata?.prompt ?? img.title}
              </p>
            )}
          </div>
        </div>
      )}
      {rootImageUrl && (
        <div className="px-3 pb-3 flex items-center gap-2">
          <img
            src={rootImageUrl}
            className="w-8 h-8 rounded object-cover border border-border"
            alt="Original"
          />
          <span className="text-[10px] text-muted-foreground">Original</span>
          {rootIsHidden && onRestore && (
            <button
              onClick={onRestore}
              className="text-[10px] text-primary hover:underline ml-auto cursor-pointer"
            >
              Restore
            </button>
          )}
        </div>
      )}
      {editChildren && editChildren.length > 0 && (
        <div className="px-3 pb-3">
          <p className="text-[10px] text-muted-foreground mb-1.5">Edits</p>
          <div className="flex flex-wrap gap-1.5">
            {editChildren.map((child) => (
              <button
                key={child.id}
                onClick={(e) => {
                  e.stopPropagation()
                  navigate({
                    to: '/dashboard/edit/$imageId',
                    params: { imageId: img.id },
                  })
                }}
                className="w-8 h-8 rounded overflow-hidden border border-border hover:border-foreground/30 transition-colors cursor-pointer"
              >
                <img
                  src={child.url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </Thumbnail>
  )
}

function MorePopover({
  disabled,
  onSelect,
}: {
  disabled: boolean
  onSelect: (count: number) => void
}) {
  const btnClass =
    'w-full text-left px-3 py-1.5 text-xs hover:bg-accent rounded transition-colors'
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          disabled={disabled}
          className="flex-1 rounded bg-muted px-2 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted/80 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {disabled ? '...' : 'More'}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        className="w-24 p-1"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <button className={btnClass} onClick={() => onSelect(2)}>
          +2
        </button>
        <button className={btnClass} onClick={() => onSelect(4)}>
          +4
        </button>
      </PopoverContent>
    </Popover>
  )
}
