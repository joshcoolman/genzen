import { EDIT_MODELS } from '@/features/ai-images/models'

interface EditModelSelectorProps {
  selectedModelIds: Array<string>
  onToggle: (id: string) => void
  maxRefImages: number
}

export function EditModelSelector({
  selectedModelIds,
  onToggle,
  maxRefImages,
}: EditModelSelectorProps) {
  const limitingModel = EDIT_MODELS.filter((m) =>
    selectedModelIds.includes(m.id),
  ).find((m) => m.maxRefImages === maxRefImages)

  return (
    <div className="space-y-3">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: '0.5rem',
        }}
      >
        {EDIT_MODELS.map((model) => {
          const isSelected = selectedModelIds.includes(model.id)
          return (
            <button
              key={model.id}
              onClick={() => onToggle(model.id)}
              className={`relative flex flex-col gap-1 rounded-md border p-3 text-left transition-colors ${
                isSelected
                  ? 'border-accent-brand bg-accent-brand/10'
                  : 'border-border bg-card hover:border-accent-brand/50'
              }`}
            >
              <span className="text-xs font-medium">{model.name}</span>
              <span className="text-xs text-muted-foreground">
                {model.description}
              </span>
              {model.maxRefImages > 0 && (
                <span className="mt-1 self-start rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {model.maxRefImages} ref
                </span>
              )}
            </button>
          )
        })}
      </div>

      {selectedModelIds.length > 0 && maxRefImages > 0 && limitingModel && (
        <p className="text-xs text-muted-foreground">
          Ref images available: {maxRefImages}
          {selectedModelIds.length > 1 && ` (limited by ${limitingModel.name})`}
        </p>
      )}
      {selectedModelIds.length > 0 && maxRefImages === 0 && (
        <p className="text-xs text-muted-foreground">
          Selected models don&apos;t support reference images
        </p>
      )}
    </div>
  )
}
