import { Plus, X } from 'lucide-react'

interface RefImageStripProps {
  images: Array<{ id: string; url: string; title: string }>
  max: number
  onAdd: () => void
  onRemove: (id: string) => void
  disabled?: boolean
}

export function RefImageStrip({
  images,
  max,
  onAdd,
  onRemove,
  disabled,
}: RefImageStripProps) {
  return (
    <div className="flex items-center gap-2">
      {images.map((img) => (
        <div key={img.id} className="relative h-12 w-12 shrink-0">
          <img
            src={img.url}
            alt={img.title}
            className="h-12 w-12 rounded object-cover"
          />
          {!disabled && (
            <button
              onClick={() => onRemove(img.id)}
              className="absolute -top-1.5 -right-1.5 rounded-full bg-destructive p-0.5 text-destructive-foreground hover:bg-destructive/80"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
      ))}
      {images.length < max && (
        <button
          onClick={onAdd}
          disabled={disabled}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded border border-dashed border-muted-foreground/40 text-muted-foreground hover:border-foreground hover:text-foreground disabled:opacity-50"
        >
          <Plus className="size-4" />
        </button>
      )}
      <span className="text-xs text-muted-foreground">
        {images.length}/{max}
      </span>
    </div>
  )
}
