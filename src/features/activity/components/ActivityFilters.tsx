import { ChevronDown, X } from 'lucide-react'
import { useMemo } from 'react'
import type { ActivityFilters as Filters, GenerationStatus } from '../types'
import { ALL_IMAGE_MODELS, getModelName } from '@/features/ai-images/models'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

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
  { value: 'processing', label: 'Processing' },
  { value: 'pending', label: 'Pending' },
]

function computeDatePreset(filters: Filters): DatePreset {
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

interface ActivityFiltersProps {
  filters: Filters
  onChange: (next: Filters) => void
  onClear: () => void
  hasActiveFilters: boolean
}

export function ActivityFilters({
  filters,
  onChange,
  onClear,
  hasActiveFilters,
}: ActivityFiltersProps) {
  const modelOptions = useMemo(() => {
    const out: Array<{ id: string; label: string }> = []
    for (const m of ALL_IMAGE_MODELS) {
      out.push({ id: m.id, label: m.name })
    }
    return out
  }, [])

  const selectedModelLabels = filters.models
    .map((id) => {
      const fromList = modelOptions.find((m) => m.id === id)
      if (fromList) return fromList.label
      return getModelName(id) || id
    })
    .filter(Boolean)

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
    <div className="flex flex-wrap items-center gap-2">
      {/* Model multi-select */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded border border-input bg-background px-3 text-xs text-foreground hover:bg-accent',
              filters.models.length > 0 && 'border-primary/60',
            )}
          >
            <span>
              Models
              {filters.models.length > 0 && (
                <span className="ml-1 text-muted-foreground">
                  ({filters.models.length})
                </span>
              )}
            </span>
            <ChevronDown className="h-3 w-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="max-h-80 w-72 overflow-y-auto p-2"
        >
          <div className="flex flex-col gap-0.5">
            {modelOptions.map((m) => {
              const checked = filters.models.includes(m.id)
              return (
                <label
                  key={m.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-accent"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleModel(m.id)}
                  />
                  <span className="flex-1 truncate">{m.label}</span>
                </label>
              )
            })}
          </div>
        </PopoverContent>
      </Popover>

      {/* Selected model chips */}
      {selectedModelLabels.slice(0, 2).map((label, i) => (
        <button
          key={`${filters.models[i]}-chip`}
          type="button"
          onClick={() => toggleModel(filters.models[i])}
          className="inline-flex h-8 items-center gap-1 rounded border border-primary/40 bg-primary/10 px-2.5 text-xs text-foreground"
        >
          <span className="truncate max-w-[120px]">{label}</span>
          <X className="h-3 w-3" />
        </button>
      ))}
      {filters.models.length > 2 && (
        <span className="text-xs text-muted-foreground">
          +{filters.models.length - 2} more
        </span>
      )}

      {/* Status pills */}
      <div className="flex items-center gap-1 rounded border border-input bg-background p-0.5">
        {STATUS_OPTIONS.map((s) => {
          const active = filters.statuses.includes(s.value)
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => toggleStatus(s.value)}
              className={cn(
                'rounded px-2 py-1 text-[11px] transition',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {s.label}
            </button>
          )
        })}
      </div>

      {/* Date preset */}
      <div className="flex items-center gap-1 rounded border border-input bg-background p-0.5">
        {DATE_PRESETS.map((d) => {
          const active = datePreset === d.value
          return (
            <button
              key={d.value}
              type="button"
              onClick={() => setDatePreset(d.value)}
              className={cn(
                'rounded px-2 py-1 text-[11px] transition',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {d.label}
            </button>
          )
        })}
      </div>

      {hasActiveFilters && (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex h-8 items-center gap-1 rounded border border-input bg-background px-2.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" />
          Clear
        </button>
      )}
    </div>
  )
}
