import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Minus,
  Plus,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { SelectionMode, UnifiedModel } from './types'

export type DisplayMode = 'inline' | 'dropdown' | 'panel'

interface ModelSelectorProps {
  mode: SelectionMode
  display?: DisplayMode
  selectedIds: Array<string>
  visibleModels: Array<UnifiedModel>
  onToggleSelected: (id: string) => void
  showGensPerModel?: boolean
  gensPerModel?: number
  onAdjustGens?: (delta: number) => void
  defaultExpanded?: boolean
  persistKey?: string
}

export function ModelSelector({
  mode,
  display = 'inline',
  selectedIds,
  visibleModels,
  onToggleSelected,
  showGensPerModel,
  gensPerModel,
  onAdjustGens,
  defaultExpanded = true,
  persistKey,
}: ModelSelectorProps) {
  const [expanded, setExpanded] = useState(() => {
    if (persistKey && typeof window !== 'undefined') {
      const stored = localStorage.getItem(persistKey)
      if (stored !== null) return stored === 'true'
    }
    return defaultExpanded
  })

  function toggleExpanded() {
    setExpanded((prev) => {
      const next = !prev
      if (persistKey) localStorage.setItem(persistKey, String(next))
      return next
    })
  }

  const gensControl = showGensPerModel &&
    gensPerModel !== undefined &&
    onAdjustGens && (
      <div className="flex h-9 items-center gap-1.5 rounded-md border border-input bg-transparent px-3 shadow-xs dark:bg-input/30">
        <button
          onClick={() => onAdjustGens(-1)}
          disabled={gensPerModel <= 1}
          className="rounded p-0.5 hover:bg-muted disabled:opacity-30"
        >
          <Minus className="h-3 w-3" />
        </button>
        <span className="w-4 text-center text-sm font-medium">
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
    )

  if (display === 'dropdown') {
    return (
      <div className="flex items-center gap-2">
        <DropdownModels
          models={visibleModels}
          selectedIds={selectedIds}
          mode={mode}
          onToggle={onToggleSelected}
        />
        {gensControl}
      </div>
    )
  }

  if (display === 'panel') {
    const selectedCount = selectedIds.length
    const selectedModel = visibleModels.find((m) => selectedIds.includes(m.id))
    const label =
      selectedCount === 0
        ? 'Select...'
        : selectedCount === 1
          ? (selectedModel?.name ?? 'Select...')
          : `Multiple (${selectedCount} models)`

    return (
      <div>
        <button
          onClick={() => toggleExpanded()}
          className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 text-left text-sm shadow-xs transition-colors dark:bg-input/30 dark:hover:bg-input/50"
        >
          <span className="text-sm truncate">{label}</span>
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </button>
        {expanded && (
          <div className="mt-1 rounded-md border border-border bg-card p-1">
            {visibleModels.map((model) => {
              const isSelected = selectedIds.includes(model.id)
              return (
                <button
                  key={model.id}
                  onClick={() => onToggleSelected(model.id)}
                  className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left transition-colors hover:bg-muted/50"
                >
                  {isSelected ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-accent-brand" />
                  ) : (
                    <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
                  )}
                  <span className="text-xs font-medium">{model.name}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // Inline mode with expand/collapse
  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => toggleExpanded()}
          className="flex items-center gap-1.5 text-left"
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Models
          </span>
          {mode === 'multi' && (
            <span className="text-xs text-muted-foreground/60">
              ({selectedIds.length} selected)
            </span>
          )}
        </button>
        {gensControl}
      </div>

      {/* Expanded pills */}
      {expanded && (
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
      )}
    </div>
  )
}

/* ---- Dropdown: compact trigger, opens a popover ---- */
function DropdownModels({
  models,
  selectedIds,
  mode,
  onToggle,
}: {
  models: Array<UnifiedModel>
  selectedIds: Array<string>
  mode: SelectionMode
  onToggle: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const selectedCount = selectedIds.length
  const selectedModel = models.find((m) => selectedIds.includes(m.id))

  const label =
    selectedCount === 0
      ? 'Select...'
      : selectedCount === 1
        ? (selectedModel?.name ?? 'Select...')
        : `Multiple (${selectedCount} models)`

  return (
    <div ref={ref} className="relative flex-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-full min-w-[11rem] items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 text-left text-sm shadow-xs transition-colors dark:bg-input/30 dark:hover:bg-input/50"
      >
        <span className="text-sm truncate">{label}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-card shadow-lg">
          <div className="max-h-64 overflow-y-auto p-1">
            {models.map((model) => {
              const isSelected = selectedIds.includes(model.id)
              return (
                <button
                  key={model.id}
                  onClick={() => {
                    onToggle(model.id)
                    if (mode === 'single') setOpen(false)
                  }}
                  className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left transition-colors hover:bg-muted/50"
                >
                  {isSelected ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-accent-brand" />
                  ) : (
                    <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
                  )}
                  <span className="text-xs font-medium">{model.name}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
