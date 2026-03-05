import { CheckCircle2, Circle } from 'lucide-react'
import { EDIT_MODELS } from '@/features/ai-images/models'

interface EditModelSelectorProps {
  selectedModelIds: Array<string>
  onToggle: (id: string) => void
}

export function EditModelSelector({
  selectedModelIds,
  onToggle,
}: EditModelSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-1">
      {EDIT_MODELS.map((model) => {
        const isSelected = selectedModelIds.includes(model.id)
        return (
          <button
            key={model.id}
            onClick={() => onToggle(model.id)}
            className={`flex items-center gap-2.5 rounded-md border px-3 py-2 text-left transition-colors ${
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
