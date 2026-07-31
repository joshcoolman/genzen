import { RunRow } from '../run-row/run-row'
import styles from './run-table.module.css'
import type { ActivityEntry } from '#/features/activity/types'
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
        <div className={styles.placeholder}>
          {hasActiveFilters
            ? 'Nothing matches the current filters.'
            : 'Nothing to show yet.'}
        </div>
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
