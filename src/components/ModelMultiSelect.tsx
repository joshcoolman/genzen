import { CheckCircle2, Circle } from 'lucide-react'

export interface ModelOption {
  id: string
  name: string
}

interface ModelMultiSelectProps {
  models: Array<ModelOption>
  selectedIds: Array<string>
  onToggle: (id: string) => void
}

export function ModelMultiSelect({
  models,
  selectedIds,
  onToggle,
}: ModelMultiSelectProps) {
  if (models.length <= 1) {
    return (
      <span className="text-xs text-muted-foreground">
        {models[0]?.name ?? 'No models'}
      </span>
    )
  }

  return (
    <div className="flex flex-wrap gap-1">
      {models.map((model) => {
        const isSelected = selectedIds.includes(model.id)
        return (
          <button
            key={model.id}
            onClick={() => onToggle(model.id)}
            className={`flex items-center gap-2 rounded-md border px-3 py-2 text-left transition-colors ${
              isSelected
                ? 'border-accent-brand bg-accent-brand/10'
                : 'border-border bg-card hover:border-accent-brand/50'
            }`}
          >
            {isSelected ? (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-accent-brand" />
            ) : (
              <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
            )}
            <span className="text-xs font-medium">{model.name}</span>
          </button>
        )
      })}
    </div>
  )
}
