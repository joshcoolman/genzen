import { Plus, X } from 'lucide-react'

interface RefImageStripProps {
  images: Array<{ id: string; url: string; title: string }>
  max: number
  onAdd?: () => void
  onRemove?: (id: string) => void
  onImageClick?: () => void
  disabled?: boolean
  /** Show element label under each thumbnail */
  showLabels?: boolean
}

export function RefImageStrip({
  images,
  max,
  onAdd,
  onRemove,
  onImageClick,
  disabled,
  showLabels,
}: RefImageStripProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {images.map((img) => (
        <div
          key={img.id}
          className={`relative shrink-0 ${showLabels ? 'w-14' : 'w-12'}`}
        >
          <div className={`relative ${showLabels ? 'h-14 w-14' : 'h-12 w-12'}`}>
            <img
              src={img.url}
              alt={img.title}
              className={`h-full w-full rounded object-cover ${onImageClick && !disabled ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
              onClick={onImageClick && !disabled ? onImageClick : undefined}
            />
            {!disabled && onRemove && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove(img.id)
                }}
                className="absolute -top-1.5 -right-1.5 rounded-full bg-destructive p-0.5 text-destructive-foreground hover:bg-destructive/80"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
          {showLabels && (
            <p className="mt-0.5 truncate text-center text-[10px] text-muted-foreground">
              {img.title}
            </p>
          )}
        </div>
      ))}
      {images.length < max && onAdd && (
        <div className={`shrink-0 ${showLabels ? 'w-14' : 'w-12'}`}>
          <button
            onClick={onAdd}
            disabled={disabled}
            className={`flex w-full items-center justify-center rounded border border-dashed border-muted-foreground/40 text-muted-foreground hover:border-foreground hover:text-foreground disabled:opacity-50 ${showLabels ? 'h-14' : 'h-12'}`}
          >
            <Plus className="size-4" />
          </button>
          {showLabels && <p className="mt-0.5 text-[10px]">&nbsp;</p>}
        </div>
      )}
      <span className="text-xs text-muted-foreground">
        {images.length}/{max}
      </span>
    </div>
  )
}
