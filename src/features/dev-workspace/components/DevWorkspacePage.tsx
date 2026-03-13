import { useState } from 'react'
import type { ModelCapability, SelectionMode } from '@/components/ModelSelector'
import { ModelSelector, useModelSelector } from '@/components/ModelSelector'

export function DevWorkspacePage() {
  const [capability, setCapability] = useState<ModelCapability>('generate')
  const [mode, setMode] = useState<SelectionMode>('multi')
  const [showGens, setShowGens] = useState(true)

  const selector = useModelSelector({ capability, mode })

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-lg font-semibold">Dev Workspace</h1>
        <p className="text-sm text-muted-foreground">
          Shared ModelSelector component testing
        </p>
      </div>

      {/* Dev toggles */}
      <div className="flex flex-wrap gap-3 rounded-lg border border-dashed border-border p-3">
        <Toggle
          label="Capability"
          options={['generate', 'edit'] as const}
          value={capability}
          onChange={setCapability}
        />
        <Toggle
          label="Mode"
          options={['single', 'multi'] as const}
          value={mode}
          onChange={setMode}
        />
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={showGens}
            onChange={(e) => setShowGens(e.target.checked)}
            className="rounded"
          />
          Gens per model
        </label>
      </div>

      {/* ModelSelector */}
      <ModelSelector
        capability={capability}
        mode={mode}
        selectedIds={selector.selectedIds}
        visibleIds={selector.visibleIds}
        visibleModels={selector.visibleModels}
        onToggleSelected={selector.toggleSelected}
        onToggleVisible={selector.toggleVisible}
        showGensPerModel={showGens}
        gensPerModel={selector.gensPerModel}
        onAdjustGens={selector.adjustGens}
      />

      {/* Debug output */}
      <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
        <span className="text-xs font-medium text-muted-foreground">Debug</span>
        <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap">
          {JSON.stringify(
            {
              selectedIds: selector.selectedIds,
              gensPerModel: selector.gensPerModel,
              visibleCount: selector.visibleIds.length,
              maxRefImages: selector.maxRefImages,
            },
            null,
            2,
          )}
        </pre>
      </div>
    </div>
  )
}

function Toggle<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: ReadonlyArray<T>
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">{label}:</span>
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`rounded px-2 py-0.5 text-xs transition-colors ${
            value === opt
              ? 'bg-accent-brand/15 text-accent-brand font-medium'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}
