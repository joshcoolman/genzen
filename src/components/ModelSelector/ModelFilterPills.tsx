import { Check } from 'lucide-react'
import type { UnifiedModel } from './types'

interface ModelFilterPillsProps {
  models: Array<UnifiedModel>
  activeIds: Array<string>
  onToggle: (id: string) => void
  onToggleAll?: () => void
}

export function ModelFilterPills({
  models,
  activeIds,
  onToggle,
  onToggleAll,
}: ModelFilterPillsProps) {
  const allActive = models.length > 0 && models.every((m) => activeIds.includes(m.id))

  return (
    <div className="flex flex-wrap gap-1 items-center">
      {models.map((model) => {
        const active = activeIds.includes(model.id)
        return (
          <button
            key={model.id}
            type="button"
            onClick={() => onToggle(model.id)}
            className={`rounded-full border px-1.5 py-px text-[9px] leading-tight transition-colors ${
              active
                ? 'border-accent-brand bg-card text-foreground'
                : 'border-border bg-muted/50 text-muted-foreground'
            }`}
          >
            {model.name}
          </button>
        )
      })}
      {models.length > 2 && onToggleAll && (
        <button
          type="button"
          onClick={onToggleAll}
          title={allActive ? 'Deselect all' : 'Select all'}
          className={`flex size-4 items-center justify-center rounded-full border transition-colors ${
            allActive
              ? 'border-accent-brand bg-accent-brand text-accent-brand-foreground'
              : 'border-border bg-muted/50 text-muted-foreground'
          }`}
        >
          <Check className="size-2.5" />
        </button>
      )}
    </div>
  )
}
