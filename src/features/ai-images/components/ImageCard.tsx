import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
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
  hidePrompts: boolean
  rootImageUrl?: string
  rootIsHidden?: boolean
  onRestore?: () => void
  onOpen: (img: SavedAiImage) => void
  onMoreLikeThis: (img: SavedAiImage, count: number) => void
  onEdit: (img: SavedAiImage) => void
  onDelete: (img: SavedAiImage) => void
  getModelName: (id: string) => string
}

export function ImageCard({
  img,
  imageUrl,
  generatingVariation,
  hidePrompts,
  rootImageUrl,
  rootIsHidden,
  onRestore,
  onOpen,
  onMoreLikeThis,
  onEdit,
  onDelete,
  getModelName,
}: ImageCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-lg border border-border bg-card">
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
        {img.generation_metadata && (
          <span className="absolute bottom-2 left-2 bg-background/80 backdrop-blur-sm text-[10px] text-muted-foreground px-1.5 py-0.5 rounded-full">
            {getModelName(img.generation_metadata.model)}
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
      </div>
      <div className="flex gap-1 p-1.5">
        <MorePopover
          disabled={generatingVariation}
          onSelect={(count) => onMoreLikeThis(img, count)}
        />
        <button
          onClick={() => onEdit(img)}
          className="flex-1 rounded bg-muted px-2 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
        >
          Edit
        </button>
      </div>
      {!hidePrompts && (
        <div className="px-3 pb-3">
          <div className="relative">
            <div className="absolute top-0 right-0">
              <CopyPromptButton
                text={
                  img.generation_metadata?.generation_type === 'variation' &&
                  img.generation_metadata.original_prompt
                    ? `${img.generation_metadata.original_prompt}\n\nVariation: ${img.generation_metadata.prompt}`
                    : (img.generation_metadata?.prompt ?? img.title)
                }
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
    </div>
  )
}

function CopyPromptButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      className="text-muted-foreground/60 hover:text-foreground transition-colors"
      aria-label="Copy prompt"
    >
      {copied ? (
        <Check className="h-4 w-4 text-green-500" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </button>
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
