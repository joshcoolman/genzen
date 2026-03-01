import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import type { SavedAiImage } from '@/features/ai-images/types'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface ImageCardProps {
  img: SavedAiImage
  imageUrl: string | undefined
  generatingVariation: boolean
  onOpen: (img: SavedAiImage) => void
  onLoadPrompt: (img: SavedAiImage) => void
  onLoadPromptAndModel: (img: SavedAiImage) => void
  onMoreLikeThis: (img: SavedAiImage, count: number) => void
  onEdit: (img: SavedAiImage) => void
  onDelete: (img: SavedAiImage) => void
  getModelName: (id: string) => string
}

export function ImageCard({
  img,
  imageUrl,
  generatingVariation,
  onOpen,
  onLoadPrompt,
  onLoadPromptAndModel,
  onMoreLikeThis,
  onEdit,
  onDelete,
  getModelName,
}: ImageCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: img.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative overflow-hidden rounded-lg border border-border bg-card ${isDragging ? 'ring-2 ring-primary' : ''}`}
    >
      <div className="relative">
        <div
          className="aspect-square w-full bg-black flex items-center justify-center cursor-zoom-in"
          onClick={() => imageUrl && onOpen(img)}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={img.title}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full bg-muted animate-pulse" />
          )}
        </div>
        {img.generation_metadata?.generation_type === 'variation' && (
          <span className="absolute top-2 left-2 bg-background/80 backdrop-blur-sm text-[10px] text-muted-foreground px-1.5 py-0.5 rounded-full">
            Variation
          </span>
        )}
        <button
          onClick={() => onDelete(img)}
          className="absolute top-1.5 right-1.5 rounded bg-background/80 backdrop-blur-sm p-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
          aria-label="Delete image"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 6h18" />
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          </svg>
        </button>
        <div className="absolute inset-x-0 bottom-0 flex gap-1 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onLoadPrompt(img)}
            className="flex-1 rounded bg-background/80 backdrop-blur-sm px-2 py-1.5 text-[11px] font-medium text-foreground hover:bg-background/95 transition-colors"
          >
            Prompt
          </button>
          <button
            onClick={() => onLoadPromptAndModel(img)}
            className="flex-1 rounded bg-background/80 backdrop-blur-sm px-2 py-1.5 text-[11px] font-medium text-foreground hover:bg-background/95 transition-colors"
          >
            P+M
          </button>
          <MorePopover
            disabled={generatingVariation}
            onSelect={(count) => onMoreLikeThis(img, count)}
          />
          <button
            onClick={() => onEdit(img)}
            className="flex-1 rounded bg-background/80 backdrop-blur-sm px-2 py-1.5 text-[11px] font-medium text-foreground hover:bg-background/95 transition-colors"
          >
            Edit
          </button>
        </div>
      </div>
      <div className="p-3 space-y-1">
        <PromptText text={img.generation_metadata?.prompt ?? img.title} />
        <div className="flex items-center justify-between text-xs text-muted-foreground/60">
          <span>
            {img.generation_metadata
              ? getModelName(img.generation_metadata.model)
              : ''}
          </span>
          <div className="flex items-center gap-1">
            <span>{new Date(img.created_at).toLocaleDateString()}</span>
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing p-0.5 rounded hover:text-foreground"
              title="Drag to reorder"
            >
              <GripVertical className="h-3.5 w-3.5" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PromptText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <p
      className={`text-xs text-muted-foreground cursor-pointer ${expanded ? '' : 'line-clamp-2'}`}
      onClick={(e) => {
        e.stopPropagation()
        setExpanded((v) => !v)
      }}
    >
      {text}
    </p>
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
          className="flex-1 rounded bg-background/80 backdrop-blur-sm px-2 py-1.5 text-[11px] font-medium text-foreground hover:bg-background/95 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
