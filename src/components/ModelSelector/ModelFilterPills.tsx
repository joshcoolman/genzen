import type { UnifiedModel } from './types'

interface ModelFilterPillsProps {
  models: Array<UnifiedModel>
  activeIds: Array<string>
  onToggle: (id: string) => void
}

export function ModelFilterPills({
  models,
  activeIds,
  onToggle,
}: ModelFilterPillsProps) {
  return (
    <div className="flex flex-wrap gap-1">
      {models.map((model) => {
        const active = activeIds.includes(model.id)
        return (
          <button
            key={model.id}
            type="button"
            onClick={() => onToggle(model.id)}
            className={`rounded-full border px-1.5 py-px text-[9px] leading-tight transition-colors ${
              active
                ? 'border-border bg-muted/50 text-muted-foreground'
                : 'border-transparent text-muted-foreground/30'
            }`}
          >
            {model.name}
          </button>
        )
      })}
    </div>
  )
}
