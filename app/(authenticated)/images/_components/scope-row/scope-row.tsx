'use client'

import { ORIGIN_FILTERS, ORIGIN_FILTER_LABELS } from '../../_hooks/use-prefs'
import styles from './scope-row.module.css'
import type { OriginFilter } from '../../_hooks/use-prefs'
import { cx } from '#/lib/utils'

/**
 * What the grid is scoped to (#444).
 *
 * **Its own row, under the toolbar, not in it.** The toolbar is controls that
 * act -- upload, new group, sort, zoom, the panel. A scope is not an action,
 * it is a statement about what you are looking at, and mixing the two is part
 * of why the pills read as one more button before #348 removed them.
 *
 * **And it is a caption, not a control.** Not `SingleSelect`, whose segmented
 * pills carry the weight of something you press: three filled chips above the
 * wall competed with the pictures, which is the one thing a gallery's chrome
 * must not do. So: a rule across the width, the three words at the right end
 * at the chip type size, and the current one simply lit. Ink is the whole
 * selected state -- no fill, no box, no underline.
 *
 * Right-aligned because the left of this row is where the grid starts, and a
 * scope sitting over the first thumbnail reads as a label for it.
 *
 * Top level only. Inside a group the group *is* the scope, and two scoping
 * controls stacked on each other only raise the question of which one wins.
 */
export function ScopeRow({
  value,
  onChange,
}: {
  value: OriginFilter
  onChange: (filter: OriginFilter) => void
}) {
  return (
    <div className={styles.row}>
      {ORIGIN_FILTERS.map((filter) => (
        <button
          key={filter}
          type="button"
          className={cx(styles.item, filter === value && styles.itemOn)}
          aria-pressed={filter === value}
          onClick={() => onChange(filter)}
        >
          {ORIGIN_FILTER_LABELS[filter]}
        </button>
      ))}
    </div>
  )
}
