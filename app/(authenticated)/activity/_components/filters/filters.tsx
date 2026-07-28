import { X } from 'lucide-react'
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
import { MultiSelect } from '#/components'

const STATUS_OPTIONS: Array<{ value: GenerationStatus; label: string }> = [
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'pending', label: 'Pending' },
]

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

  return (
    <div className={styles.filters}>
      <MultiSelect
        label="Models"
        options={modelOptions}
        selected={filters.models}
        onToggle={toggleModel}
        onClear={() => onChange({ ...filters, models: [] })}
      />

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

      {hasActiveFilters && (
        <button type="button" onClick={onClear} className={styles.clear}>
          <X className={styles.clearIcon} />
          Clear
        </button>
      )}
    </div>
  )
}
