'use client'

import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Minus,
  Plus,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import styles from './model-selector.module.css'
import type {
  SelectionMode,
  UnifiedModel,
} from '#/features/ai-images/model-selector/types'
import { cx } from '#/lib/utils'

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

  if (visibleModels.length <= 1) {
    return (
      <div className={styles.row}>
        <span className={styles.singleName}>
          {visibleModels[0]?.name ?? 'No models'}
        </span>
        {showGensPerModel && gensPerModel !== undefined && onAdjustGens && (
          <div className={styles.gens}>
            <button
              onClick={() => onAdjustGens(-1)}
              disabled={gensPerModel <= 1}
              className={styles.gensStep}
            >
              <Minus className={styles.gensStepIcon} />
            </button>
            <span className={styles.gensValue}>{gensPerModel}</span>
            <button
              onClick={() => onAdjustGens(1)}
              disabled={gensPerModel >= 5}
              className={styles.gensStep}
            >
              <Plus className={styles.gensStepIcon} />
            </button>
          </div>
        )}
      </div>
    )
  }

  const gensControl = showGensPerModel &&
    gensPerModel !== undefined &&
    onAdjustGens && (
      <div className={styles.gens}>
        <button
          onClick={() => onAdjustGens(-1)}
          disabled={gensPerModel <= 1}
          className={styles.gensStep}
        >
          <Minus className={styles.gensStepIcon} />
        </button>
        <span className={styles.gensValue}>{gensPerModel}</span>
        <button
          onClick={() => onAdjustGens(1)}
          disabled={gensPerModel >= 5}
          className={styles.gensStep}
        >
          <Plus className={styles.gensStepIcon} />
        </button>
      </div>
    )

  if (display === 'dropdown') {
    return (
      <div className={styles.row}>
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
        <button onClick={() => toggleExpanded()} className={styles.field}>
          <span className={styles.fieldLabel}>{label}</span>
          <ChevronDown
            className={cx(styles.chevron, expanded && styles.chevronOpen)}
          />
        </button>
        {expanded && (
          <div className={styles.list}>
            {visibleModels.map((model) => {
              const isSelected = selectedIds.includes(model.id)
              return (
                <button
                  key={model.id}
                  onClick={() => onToggleSelected(model.id)}
                  className={styles.item}
                >
                  {isSelected ? (
                    <CheckCircle2
                      className={cx(styles.itemIcon, styles.itemIconOn)}
                    />
                  ) : (
                    <Circle className={styles.itemIcon} />
                  )}
                  <span className={styles.itemName}>{model.name}</span>
                  {model.displayPrice && (
                    <span className={styles.itemPrice}>
                      {model.displayPrice}
                    </span>
                  )}
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
    <div className={styles.inline}>
      {/* Header row */}
      <div className={styles.inlineHeader}>
        <button
          onClick={() => toggleExpanded()}
          className={styles.inlineToggle}
        >
          {expanded ? (
            <ChevronDown className={styles.inlineToggleIcon} />
          ) : (
            <ChevronRight className={styles.inlineToggleIcon} />
          )}
          <span className={styles.inlineTitle}>Models</span>
          {mode === 'multi' && (
            <span className={styles.inlineCount}>
              ({selectedIds.length} selected)
            </span>
          )}
        </button>
        {gensControl}
      </div>

      {/* Expanded pills */}
      {expanded && (
        <div className={styles.pills}>
          {visibleModels.map((model) => {
            const isSelected = selectedIds.includes(model.id)
            return (
              <button
                key={model.id}
                onClick={() => onToggleSelected(model.id)}
                title={
                  model.displayPrice
                    ? `${model.description} — ${model.displayPrice}`
                    : model.description
                }
                className={cx(styles.pill, isSelected && styles.pillSelected)}
              >
                {isSelected ? (
                  <CheckCircle2
                    className={cx(styles.pillIcon, styles.pillIconOn)}
                  />
                ) : (
                  <Circle className={styles.pillIcon} />
                )}
                <span className={styles.pillName}>{model.name}</span>
                {model.displayPrice && (
                  <span className={styles.pillPrice}>{model.displayPrice}</span>
                )}
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
    <div ref={ref} className={styles.dropdownRoot}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cx(styles.field, styles.fieldWide)}
      >
        <span className={styles.fieldLabel}>{label}</span>
        <ChevronDown
          className={cx(styles.chevron, open && styles.chevronOpen)}
        />
      </button>
      {open && (
        <div className={cx(styles.list, styles.listFloating)}>
          <div className={styles.listScroll}>
            {models.map((model) => {
              const isSelected = selectedIds.includes(model.id)
              return (
                <button
                  key={model.id}
                  onClick={() => {
                    onToggle(model.id)
                    if (mode === 'single') setOpen(false)
                  }}
                  className={styles.item}
                >
                  {isSelected ? (
                    <CheckCircle2
                      className={cx(styles.itemIcon, styles.itemIconOn)}
                    />
                  ) : (
                    <Circle className={styles.itemIcon} />
                  )}
                  <span className={styles.itemName}>{model.name}</span>
                  {model.displayPrice && (
                    <span className={styles.itemPrice}>
                      {model.displayPrice}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
