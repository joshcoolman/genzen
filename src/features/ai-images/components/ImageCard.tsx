import { useNavigate } from '@tanstack/react-router'
import type { SavedAiImage } from '@/features/ai-images/types'
import type { EditChildrenMap } from '@/features/ai-images/hooks/use-edit-children'
import { Thumbnail } from '@/components/Thumbnail'
import { ExpandableText } from '@/components/ExpandableText'

interface ImageCardProps {
  img: SavedAiImage
  imageUrl: string | undefined
  objectFit?: 'contain' | 'cover'
  rootImageUrl?: string
  rootIsHidden?: boolean
  editChildren?: EditChildrenMap[string]
  onRestore?: () => void
  onOpen: (img: SavedAiImage) => void
  onDelete: (img: SavedAiImage) => void
  getModelName: (id: string) => string
}

export function ImageCard({
  img,
  imageUrl,
  objectFit,
  rootImageUrl,
  rootIsHidden,
  editChildren,
  onRestore,
  onOpen,
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
      onDelete={() => onDelete(img)}
      onClick={() => imageUrl && onOpen(img)}
    >
      <div className="p-1.5">
        <button
          onClick={() =>
            navigate({
              to: '/dashboard/edit/$imageId',
              params: { imageId: img.id },
            })
          }
          className="w-full rounded bg-muted px-2 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
        >
          Edit
        </button>
      </div>
      <ExpandableText
        text={img.generation_metadata?.prompt ?? img.title}
        className="px-3 pt-1 pb-3"
        textClassName="text-xs text-muted-foreground"
      />
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
