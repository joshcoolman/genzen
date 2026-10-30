import { RunRow } from '../run-row/run-row'
import styles from './run-table.module.css'
import type { ActivityEntry } from '#/features/activity/types'
import { EmptyState } from '#/components'
import { imageUrl } from '#/lib/image-url'

interface RunTableProps {
  entries: Array<ActivityEntry>
  isLoading: boolean
  hasActiveFilters: boolean
  onSelect: (id: string) => void
}

export function RunTable({
  entries,
  isLoading,
  hasActiveFilters,
  onSelect,
}: RunTableProps) {
  return (
    <div className={styles.table}>
      <div className={styles.columns}>
        <div />
        <div>Model</div>
        <div>Prompt</div>
        <div>Status</div>
        <div>Duration</div>
        <div>Cost</div>
        <div className={styles.columnTime}>Time</div>
      </div>

      {isLoading && entries.length === 0 ? (
        <div className={styles.placeholder}>Loading activity…</div>
      ) : entries.length === 0 ? (
        hasActiveFilters ? (
          <EmptyState title="Nothing matches these filters">
            Clear a filter to see more runs.
          </EmptyState>
        ) : (
          <EmptyState title="No runs yet">
            Every generation lands here with its cost and time, failures
            included.
          </EmptyState>
        )
      ) : (
        <div className={styles.rows}>
          {entries.map((entry) => (
            <RunRow
              key={entry.id}
              entry={entry}
              thumbnailUrl={
                entry.thumbnailPath ? imageUrl(entry.id, 'thumb') : null
              }
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}
