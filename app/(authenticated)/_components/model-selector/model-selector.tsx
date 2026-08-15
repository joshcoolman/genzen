'use client'

import { CheckCircle2, ChevronDown, Circle, MinusCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import styles from './model-selector.module.css'
import type {
  SelectionMode,
  UnifiedModel,
} from '#/features/ai-images/model-selector/types'
import { formatPrice } from '#/features/ai-images/model-selector/unified-models'
import { cx } from '#/lib/utils'

/** The `inline` pill wrap went with #341 -- nothing rendered it, and the table
 *  it would have had to grow was a third copy of the same three columns. */
export type DisplayMode = 'dropdown' | 'panel'

interface ModelSelectorProps {
  mode: SelectionMode
  display?: DisplayMode
  selectedIds: Array<string>
  visibleModels: Array<UnifiedModel>
  onToggleSelected: (id: string) => void
  /** The header tick: everything or nothing (#358). Absent in single mode,
   *  where "all" means nothing. */
  onToggleAll?: () => void
  /** Cmd/Ctrl-click a row: that model and no other (#358). Absent in single
   *  mode, where a plain click already means exactly that. */
  onSelectOnly?: (id: string) => void
  /**
   * Images staged right now. Rows that cannot hold them all are dimmed -- the
   * only thing the picker says about a limit, because nothing enforces one any
   * more (#341). Dimmed still selects: the submit sends what fits and the card
   * says how many it used.
   */
  stagedImageCount?: number
  defaultExpanded?: boolean
  persistKey?: string
}

/**
 * Three columns: name, dollars per image, images held.
 *
 * `Refs` is the endpoint's capacity, always, staged set or not. It used to be
 * "n of m" against the staged count and the second number was redundant -- you
 * staged five, the row says 1, so it uses 1. A model with no image input at all
 * shows an em dash, which is the state this picker exists to make safe: an
 * entry can now be a name and an endpoint id with nothing verified about it.
 */
export function ModelSelector({
  mode,
  display = 'panel',
  selectedIds,
  visibleModels,
  onToggleSelected,
  onToggleAll,
  onSelectOnly,
  stagedImageCount = 0,
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
      </div>
    )
  }

  if (display === 'dropdown') {
    return (
      <div className={styles.row}>
        <DropdownModels
          onToggleAll={onToggleAll}
          onSelectOnly={onSelectOnly}
          models={visibleModels}
          selectedIds={selectedIds}
          mode={mode}
          stagedImageCount={stagedImageCount}
          onToggle={onToggleSelected}
        />
      </div>
    )
  }

  return (
    <div>
      <button onClick={() => toggleExpanded()} className={styles.field}>
        <span className={styles.fieldLabel}>
          {selectionLabel(visibleModels, selectedIds)}
        </span>
        <ChevronDown
          className={cx(styles.chevron, expanded && styles.chevronOpen)}
        />
      </button>
      {expanded && (
        <div className={styles.list}>
          <ModelTable
            onToggleAll={onToggleAll}
            onSelectOnly={onSelectOnly}
            models={visibleModels}
            selectedIds={selectedIds}
            stagedImageCount={stagedImageCount}
            onToggle={onToggleSelected}
          />
        </div>
      )}
    </div>
  )
}

function selectionLabel(
  models: Array<UnifiedModel>,
  selectedIds: Array<string>,
): string {
  if (selectedIds.length === 0) return 'Select...'
  if (selectedIds.length > 1) return `Multiple (${selectedIds.length} models)`
  return models.find((m) => selectedIds.includes(m.id))?.name ?? 'Select...'
}

function ModelTable({
  models,
  selectedIds,
  stagedImageCount,
  onToggle,
  onToggleAll,
  onSelectOnly,
  onAfterToggle,
}: {
  models: Array<UnifiedModel>
  selectedIds: Array<string>
  stagedImageCount: number
  onToggle: (id: string) => void
  onToggleAll?: () => void
  onSelectOnly?: (id: string) => void
  onAfterToggle?: () => void
}) {
  const allSelected =
    models.length > 0 && models.every((m) => selectedIds.includes(m.id))
  const someSelected = selectedIds.length > 0

  return (
    <>
      {/* The header is a row of column labels and one control: the tick in the
          same column as every row's, because that is what it toggles. Three
          states, like any tri-state checkbox -- all, some, none -- so it also
          reports the selection rather than only changing it. */}
      <div className={cx(styles.item, styles.head)}>
        {onToggleAll ? (
          <button
            type="button"
            className={styles.headToggle}
            aria-label={
              allSelected ? 'Deselect all models' : 'Select all models'
            }
            aria-pressed={allSelected}
            onClick={onToggleAll}
          >
            {allSelected ? (
              <CheckCircle2
                className={cx(styles.itemIcon, styles.itemIconOn)}
              />
            ) : someSelected ? (
              <MinusCircle
                className={cx(styles.itemIcon, styles.headIconSome)}
              />
            ) : (
              <Circle className={styles.itemIcon} />
            )}
          </button>
        ) : (
          <span className={styles.itemIcon} aria-hidden="true" />
        )}
        <span className={styles.itemName} aria-hidden="true">
          Model
        </span>
        <span className={styles.itemPrice} aria-hidden="true">
          $
        </span>
        <span className={styles.itemRefs} aria-hidden="true">
          Refs
        </span>
      </div>
      {models.map((model) => {
        const isSelected = selectedIds.includes(model.id)
        // Capacity 0 is a model with no image input: it drops the whole set,
        // so it is "cannot hold these" the moment there is a set at all.
        const truncates = stagedImageCount > model.capacity
        return (
          <button
            key={model.id}
            /* Cmd/Ctrl-click solos a model: it alone, everything else off
               (#358). The same modifier the grid uses for its power moves, and
               the same reasoning -- the common case is toggling one row, and
               "I want just this one" was otherwise nine clicks off. Plain
               click is untouched. */
            onClick={(e) => {
              if (onSelectOnly && (e.metaKey || e.ctrlKey)) {
                onSelectOnly(model.id)
              } else {
                onToggle(model.id)
              }
              onAfterToggle?.()
            }}
            title={
              truncates
                ? `${model.description} — uses ${model.capacity} of your ${stagedImageCount} images`
                : model.description
            }
            className={cx(styles.item, truncates && styles.itemTruncates)}
          >
            {isSelected ? (
              <CheckCircle2
                className={cx(styles.itemIcon, styles.itemIconOn)}
              />
            ) : (
              <Circle className={styles.itemIcon} />
            )}
            <span className={styles.itemName}>{model.name}</span>
            <span className={styles.itemPrice}>{formatPrice(model.price)}</span>
            <span className={styles.itemRefs}>{model.capacity || '—'}</span>
          </button>
        )
      })}
    </>
  )
}

/* ---- Dropdown: compact trigger, opens a popover ---- */
function DropdownModels({
  models,
  selectedIds,
  mode,
  stagedImageCount,
  onToggle,
  onToggleAll,
  onSelectOnly,
}: {
  models: Array<UnifiedModel>
  selectedIds: Array<string>
  mode: SelectionMode
  stagedImageCount: number
  onToggle: (id: string) => void
  onToggleAll?: () => void
  onSelectOnly?: (id: string) => void
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

  return (
    <div ref={ref} className={styles.dropdownRoot}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cx(styles.field, styles.fieldWide)}
      >
        <span className={styles.fieldLabel}>
          {selectionLabel(models, selectedIds)}
        </span>
        <ChevronDown
          className={cx(styles.chevron, open && styles.chevronOpen)}
        />
      </button>
      {open && (
        <div className={cx(styles.list, styles.listFloating)}>
          <div className={styles.listScroll}>
            <ModelTable
              models={models}
              selectedIds={selectedIds}
              stagedImageCount={stagedImageCount}
              onToggle={onToggle}
              onToggleAll={onToggleAll}
              onSelectOnly={onSelectOnly}
              onAfterToggle={() => {
                if (mode === 'single') setOpen(false)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
