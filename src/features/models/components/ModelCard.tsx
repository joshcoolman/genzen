import type { FalModel } from '../types'

interface ModelCardProps {
  model: FalModel
  onClick: () => void
}

export function ModelCard({ model, onClick }: ModelCardProps) {
  return (
    <button
      onClick={onClick}
      className="group flex items-start gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:border-foreground/20"
    >
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
        {model.thumbnail_url ? (
          <img
            src={model.thumbnail_url}
            alt={model.display_name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">
            --
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h3 className="text-sm font-medium leading-tight">
          {model.display_name}
        </h3>
        {model.description && (
          <p className="text-xs text-muted-foreground">{model.description}</p>
        )}
      </div>
    </button>
  )
}
