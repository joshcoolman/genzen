import { ChevronLeft, ChevronRight } from 'lucide-react'
import styles from './pagination.module.css'

export interface PaginationProps {
  page: number
  totalPages: number
  total: number
  /** Singular; pluralised with a trailing "s". Pass the plural form yourself
   *  if the word is irregular. */
  itemNoun: string
  onChange: (page: number) => void
}

/** Renders nothing for a single page, so the view can compose it
 *  unconditionally rather than carrying the branch. */
export function Pagination({
  page,
  totalPages,
  total,
  itemNoun,
  onChange,
}: PaginationProps) {
  if (totalPages <= 1) return null

  return (
    <div className={styles.pagination}>
      <span>
        Page {page + 1} of {totalPages} · {total.toLocaleString()} {itemNoun}
        {total === 1 ? '' : 's'}
      </span>
      <div className={styles.buttons}>
        <button
          type="button"
          onClick={() => onChange(Math.max(0, page - 1))}
          disabled={page === 0}
          className={styles.button}
          aria-label="Previous page"
        >
          <ChevronLeft className={styles.buttonIcon} />
        </button>
        <button
          type="button"
          onClick={() => onChange(Math.min(totalPages - 1, page + 1))}
          disabled={page >= totalPages - 1}
          className={styles.button}
          aria-label="Next page"
        >
          <ChevronRight className={styles.buttonIcon} />
        </button>
      </div>
    </div>
  )
}
