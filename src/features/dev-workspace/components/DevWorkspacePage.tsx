import { useState } from 'react'
import type {
  DisplayMode,
  ModelCapability,
  SelectionMode,
} from '@/components/ModelSelector'
import { ModelSelector, useModelSelector } from '@/components/ModelSelector'
import { ImageSourceButtons } from '@/components/ImageSourceButtons'
import { AspectRatioSelect } from '@/components/AspectRatioSelect'

export function DevWorkspacePage() {
  const [capability, setCapability] = useState<ModelCapability>('generate')
  const [mode, setMode] = useState<SelectionMode>('multi')
  const [display, setDisplay] = useState<DisplayMode>('inline')
  const [showGens, setShowGens] = useState(true)

  // Aspect ratio state (no-op, just for composability check)
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>(
    'landscape',
  )
  const [aspectRatio, setAspectRatio] = useState('16:9')

  const selector = useModelSelector({ capability, mode })

  return (
    <div className="space-y-6 p-6">
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
        <Toggle
          label="Display"
          options={['inline', 'dropdown'] as const}
          value={display}
          onChange={setDisplay}
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

      {/* Composability test: shared components in a row */}
      <div className="relative rounded-lg border-2 border-dashed border-emerald-500/50 p-4">
        <span className="absolute -top-2.5 left-3 bg-background px-1.5 text-[10px] font-medium uppercase tracking-wider text-emerald-500">
          Composability Test
        </span>
        <div className="flex items-start gap-4">
          {/* Image source buttons */}
          <ImageSourceButtons
            onFileSelected={() => {}}
            library={{
              images: [],
              imageUrls: {},
              isLoading: false,
              onSelect: () => {},
            }}
            className="flex items-center gap-1"
          />

          {/* Aspect ratio */}
          <AspectRatioSelect
            orientation={orientation}
            aspectRatio={aspectRatio}
            onOrientationChange={setOrientation}
            onAspectRatioChange={setAspectRatio}
          />

          {/* ModelSelector */}
          <div className="flex-1">
            <ModelSelector
              mode={mode}
              display={display}
              defaultExpanded
              selectedIds={selector.selectedIds}
              visibleModels={selector.models}
              onToggleSelected={selector.toggleSelected}
              showGensPerModel={showGens}
              gensPerModel={selector.gensPerModel}
              onAdjustGens={selector.adjustGens}
            />
          </div>
        </div>
      </div>

      {/* Debug output */}
      <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
        <span className="text-xs font-medium text-muted-foreground">Debug</span>
        <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap">
          {JSON.stringify(
            {
              selectedIds: selector.selectedIds,
              gensPerModel: selector.gensPerModel,
              modelCount: selector.models.length,
              maxRefImages: selector.maxRefImages,
              aspectRatio: `${orientation} ${aspectRatio}`,
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
