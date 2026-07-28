'use client'

import { ChevronDown } from 'lucide-react'
import { clsx } from 'clsx'
import { Checkbox } from '../../ui/checkbox/checkbox'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../ui/popover/popover'
import styles from './multi-select.module.css'

export interface MultiSelectOption {
  id: string
  label: string
}

export interface MultiSelectProps {
  /** Shown on the trigger; the selected count is appended when non-zero. */
  label: string
  options: Array<MultiSelectOption>
  selected: Array<string>
  onToggle: (id: string) => void
  onClear: () => void
}

export function MultiSelect({
  label,
  options,
  selected,
  onToggle,
  onClear,
}: MultiSelectProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={clsx(
            styles.trigger,
            selected.length > 0 && styles.triggerActive,
          )}
        >
          <span>
            {label}
            {selected.length > 0 && (
              <span className={styles.count}>({selected.length})</span>
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
        {selected.length > 0 && (
          <button type="button" onClick={onClear} className={styles.clearAll}>
            Clear all
            <span className={styles.clearAllCount}>{selected.length}</span>
          </button>
        )}
        <div className={styles.optionList}>
          {options.map((o) => (
            <label key={o.id} className={styles.option}>
              <Checkbox
                checked={selected.includes(o.id)}
                onCheckedChange={() => onToggle(o.id)}
              />
              <span className={styles.optionLabel}>{o.label}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
