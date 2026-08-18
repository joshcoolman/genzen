'use client'

import styles from './swatch-list.module.css'
import type { ThemeCore } from '#/features/theme'

/* The labels are the point of the six-knob design: the user picks "the page",
 * "panels", "the primary ink" -- not `--surface-raised`, which is derived, and
 * not `--danger`, which they must not be able to recolor. */
const SWATCHES: Array<{ key: keyof ThemeCore; label: string; hint: string }> = [
  { key: 'bg', label: 'Background', hint: 'The page itself' },
  { key: 'surface', label: 'Surface', hint: 'Panels, cards and menus' },
  { key: 'text', label: 'Text', hint: 'The primary ink' },
  { key: 'muted', label: 'Muted text', hint: 'Captions and labels' },
  { key: 'accent', label: 'Accent', hint: 'Buttons, links and selection' },
  { key: 'border', label: 'Border', hint: 'Lines and dividers' },
]

interface SwatchListProps {
  values: ThemeCore
  onChange: (key: keyof ThemeCore, value: string) => void
}

export function SwatchList({ values, onChange }: SwatchListProps) {
  return (
    <div className={styles.list}>
      {SWATCHES.map(({ key, label, hint }) => (
        <label key={key} className={styles.swatch}>
          <input
            type="color"
            name={key}
            value={values[key]}
            onChange={(event) => onChange(key, event.target.value)}
            className={styles.picker}
            aria-label={label}
          />
          <span className={styles.text}>
            <span className={styles.label}>{label}</span>
            <span className={styles.hint}>{hint}</span>
          </span>
          <span className={styles.value}>{values[key]}</span>
        </label>
      ))}
    </div>
  )
}
