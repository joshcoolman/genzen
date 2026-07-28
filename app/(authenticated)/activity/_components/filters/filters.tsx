import { ChevronDown, X } from 'lucide-react'
import { useMemo } from 'react'
import { clsx } from 'clsx'
import styles from './filters.module.css'
import type {
  ActivityFilters,
  GenerationStatus,
} from '#/features/activity/types'
import {
  IMAGE_MODELS,
  RETIRED_MODEL_NAMES,
  pickerId,
} from '#/features/ai-images/models'
import { Checkbox, Popover, PopoverContent, PopoverTrigger } from '#/components'

type DatePreset = 'all' | 'today' | '7d' | '30d'

const DATE_PRESETS: Array<{ value: DatePreset; label: string }> = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
]

const STATUS_OPTIONS: Array<{ value: GenerationStatus; label: string }> = [
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'pending', label: 'Pending' },
]

function computeDatePreset(filters: ActivityFilters): DatePreset {
  if (!filters.dateFrom) return 'all'
  const from = new Date(filters.dateFrom)
  const now = new Date()
  const diffMs = now.getTime() - from.getTime()
  const diffHours = diffMs / (1000 * 60 * 60)
  if (diffHours < 36) return 'today'
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  if (diffDays < 10) return '7d'
  if (diffDays < 45) return '30d'
  return 'all'
}

function computeDateFrom(preset: DatePreset): string | null {
  if (preset === 'all') return null
  const now = new Date()
  if (preset === 'today') {
    const start = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0,
    )
    return start.toISOString()
  }
  const days = preset === '7d' ? 7 : 30
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  return from.toISOString()
}

interface FiltersProps {
  filters: ActivityFilters
  onChange: (next: ActivityFilters) => void
  onClear: () => void
  hasActiveFilters: boolean
}

export function Filters({
  filters,
  onChange,
  onClear,
  hasActiveFilters,
}: FiltersProps) {
  const modelOptions = useMemo(() => {
    const out: Array<{ id: string; label: string }> = []
    for (const m of IMAGE_MODELS) {
      out.push({ id: pickerId(m), label: m.name })
    }
    // Activity outlives the lineup: rows made by a model that has since been
    // cut still need to be filterable, or the history is there but unreachable.
    for (const [id, label] of Object.entries(RETIRED_MODEL_NAMES)) {
      if (label) out.push({ id, label: `${label} (retired)` })
    }
    return out
  }, [])

  const datePreset = computeDatePreset(filters)

  const toggleModel = (id: string) => {
    const next = filters.models.includes(id)
      ? filters.models.filter((m) => m !== id)
      : [...filters.models, id]
    onChange({ ...filters, models: next })
  }

  const toggleStatus = (s: GenerationStatus) => {
    const next = filters.statuses.includes(s)
      ? filters.statuses.filter((x) => x !== s)
      : [...filters.statuses, s]
    onChange({ ...filters, statuses: next })
  }

  const setDatePreset = (preset: DatePreset) => {
    onChange({
      ...filters,
      dateFrom: computeDateFrom(preset),
      dateTo: null,
    })
  }

  return (
    <div className={styles.filters}>
      {/* Model multi-select */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={clsx(
              styles.modelTrigger,
              filters.models.length > 0 && styles.modelTriggerActive,
            )}
          >
            <span>
              Models
              {filters.models.length > 0 && (
                <span className={styles.modelCount}>
                  ({filters.models.length})
                </span>
              )}
            </span>
            <ChevronDown className={styles.chevron} />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          collisionPadding={8}
          className={styles.popover}
        >
          {filters.models.length > 0 && (
            <button
              type="button"
              onClick={() => onChange({ ...filters, models: [] })}
              className={styles.clearAll}
            >
              Clear all
              <span className={styles.clearAllCount}>
                {filters.models.length}
              </span>
            </button>
          )}
          <div className={styles.optionList}>
            {modelOptions.map((m) => {
              const checked = filters.models.includes(m.id)
              return (
                <label key={m.id} className={styles.option}>
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleModel(m.id)}
                  />
                  <span className={styles.optionLabel}>{m.label}</span>
                </label>
              )
            })}
          </div>
        </PopoverContent>
      </Popover>

      {/* Status pills */}
      <div className={styles.pillGroup}>
        {STATUS_OPTIONS.map((s) => {
          const active = filters.statuses.includes(s.value)
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => toggleStatus(s.value)}
              className={clsx(
                styles.pill,
                active ? styles.pillActive : styles.pillInactive,
              )}
            >
              {s.label}
            </button>
          )
        })}
      </div>

      {/* Date preset */}
      <div className={styles.pillGroup}>
        {DATE_PRESETS.map((d) => {
          const active = datePreset === d.value
          return (
            <button
              key={d.value}
              type="button"
              onClick={() => setDatePreset(d.value)}
              className={clsx(
                styles.pill,
                active ? styles.pillActive : styles.pillInactive,
              )}
            >
              {d.label}
            </button>
          )
        })}
      </div>

      {hasActiveFilters && (
        <button type="button" onClick={onClear} className={styles.clear}>
          <X className={styles.clearIcon} />
          Clear
        </button>
      )}
    </div>
  )
}
