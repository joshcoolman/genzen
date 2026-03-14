import { CheckCircle2, Circle, Minus, Plus, Settings } from 'lucide-react'
import { useState } from 'react'
import { getModelsByCapability } from './models'
import type { ModelCapability, SelectionMode, UnifiedModel } from './types'

interface ModelSelectorProps {
  capability: ModelCapability
  mode: SelectionMode
  selectedIds: Array<string>
  visibleIds: Array<string>
  visibleModels: Array<UnifiedModel>
  onToggleSelected: (id: string) => void
  onToggleVisible: (id: string) => void
  showGensPerModel?: boolean
  gensPerModel?: number
  onAdjustGens?: (delta: number) => void
}

type GroupedModels = Array<{ category: string; models: Array<UnifiedModel> }>

function groupByCategory(models: Array<UnifiedModel>): GroupedModels {
  const groups = new Map<string, Array<UnifiedModel>>()
  for (const model of models) {
    const key = model.category ?? 'Edit'
    const group = groups.get(key) ?? []
    group.push(model)
    groups.set(key, group)
  }
  return Array.from(groups.entries()).map(([category, models]) => ({
    category,
    models,
  }))
}

export function ModelSelector({
  capability,
  mode,
  selectedIds,
  visibleIds,
  visibleModels,
  onToggleSelected,
  onToggleVisible,
  showGensPerModel,
  gensPerModel,
  onAdjustGens,
}: ModelSelectorProps) {
  const [showVisibilityPanel, setShowVisibilityPanel] = useState(false)
  const grouped = groupByCategory(visibleModels)

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {mode === 'single' ? 'Select Model' : 'Select Models'}
          </span>
          <span className="text-xs text-muted-foreground/60">
            ({selectedIds.length} selected)
          </span>
        </div>
        <div className="flex items-center gap-2">
          {showGensPerModel && gensPerModel !== undefined && onAdjustGens && (
            <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1">
              <span className="text-xs text-muted-foreground">Gens</span>
              <button
                onClick={() => onAdjustGens(-1)}
                disabled={gensPerModel <= 1}
                className="rounded p-0.5 hover:bg-muted disabled:opacity-30"
              >
                <Minus className="h-3 w-3" />
              </button>
              <span className="w-4 text-center text-xs font-medium">
                {gensPerModel}
              </span>
              <button
                onClick={() => onAdjustGens(1)}
                disabled={gensPerModel >= 5}
                className="rounded p-0.5 hover:bg-muted disabled:opacity-30"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
          )}
          <button
            onClick={() => setShowVisibilityPanel((v) => !v)}
            className={`rounded-md p-1.5 transition-colors ${
              showVisibilityPanel
                ? 'bg-accent-brand/10 text-accent-brand'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Model pills */}
      <div className="flex flex-wrap gap-1">
        {visibleModels.map((model) => {
          const isSelected = selectedIds.includes(model.id)
          return (
            <button
              key={model.id}
              onClick={() => onToggleSelected(model.id)}
              title={model.description}
              className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-left transition-colors ${
                isSelected
                  ? 'border-accent-brand bg-accent-brand/10'
                  : 'border-border bg-card hover:border-accent-brand/50'
              }`}
            >
              {isSelected ? (
                <CheckCircle2 className="h-3 w-3 shrink-0 text-accent-brand" />
              ) : (
                <Circle className="h-3 w-3 shrink-0 text-muted-foreground/40" />
              )}
              <span className="text-xs font-medium">{model.name}</span>
            </button>
          )
        })}
      </div>

      {/* Visibility config panel */}
      {showVisibilityPanel && (
        <VisibilityPanel
          capability={capability}
          visibleIds={visibleIds}
          onToggleVisible={onToggleVisible}
        />
      )}
    </div>
  )
}

function VisibilityPanel({
  capability,
  visibleIds,
  onToggleVisible,
}: {
  capability: ModelCapability
  visibleIds: Array<string>
  onToggleVisible: (id: string) => void
}) {
  const allModels = getModelsByCapability(capability)

  return (
    <div className="rounded-lg border border-border bg-card/50 p-3 space-y-2">
      <span className="text-xs font-medium text-muted-foreground">
        Visible Models
      </span>
      <div className="space-y-0.5">
        {allModels.map((model) => {
          const isVisible = visibleIds.includes(model.id)
          return (
            <button
              key={model.id}
              onClick={() => onToggleVisible(model.id)}
              className="flex w-full items-center gap-2 rounded px-2 py-1 text-left hover:bg-muted/50 transition-colors"
            >
              {isVisible ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-accent-brand" />
              ) : (
                <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground/90" />
              )}
              <span
                className={`text-xs ${isVisible ? 'font-medium' : 'text-muted-foreground/90'}`}
              >
                {model.name}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
