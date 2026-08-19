'use client'

import { ORIGIN_FILTERS, ORIGIN_FILTER_LABELS } from '../../_hooks/use-prefs'
import styles from './scope-row.module.css'
import type { OriginFilter } from '../../_hooks/use-prefs'
import { SingleSelect } from '#/components'

/**
 * What the grid is scoped to (#444).
 *
 * **Its own row, under the toolbar, not in it.** The toolbar is controls that
 * act -- upload, new group, sort, zoom, the panel. A scope is not an action,
 * it is a statement about what you are looking at, and mixing the two is how
 * the pills read as one more button before #348 removed them.
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
      <SingleSelect<OriginFilter>
        options={ORIGIN_FILTERS.map((filter) => ({
          value: filter,
          label: ORIGIN_FILTER_LABELS[filter],
        }))}
        value={value}
        /* `SingleSelect` clears on a second click of the active pill. Here
           "no scope" is `all`, so that widens rather than doing nothing. */
        onChange={(next) => onChange(next ?? 'all')}
      />
    </div>
  )
}
