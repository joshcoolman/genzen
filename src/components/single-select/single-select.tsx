'use client'

import { clsx } from 'clsx'
import styles from './single-select.module.css'

export interface SingleSelectOption<T extends string> {
  value: T
  label: string
}

export interface SingleSelectProps<T extends string> {
  options: Array<SingleSelectOption<T>>
  /** `null` means no choice -- for a filter, that is "everything". */
  value: T | null
  onChange: (value: T | null) => void
}

/** A segmented pill group where one option is chosen at a time, and choosing
 *  the chosen one clears it. Typically a state/status filter. */
export function SingleSelect<T extends string>({
  options,
  value,
  onChange,
}: SingleSelectProps<T>) {
  return (
    <div className={styles.group}>
      {options.map((o) => {
        const active = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active ? null : o.value)}
            className={clsx(
              styles.pill,
              active ? styles.pillActive : styles.pillInactive,
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
