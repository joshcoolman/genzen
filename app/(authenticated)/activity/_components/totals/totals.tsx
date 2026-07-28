import { Clock4, DollarSign, Receipt } from 'lucide-react'
import styles from './totals.module.css'
import type { ActivityTotals } from '#/features/activity/types'
import { formatDurationMs } from '#/lib/time-format'

function formatDollarsFromCents(cents: number): string {
  const dollars = cents / 100
  if (dollars === 0) return '$0.00'
  if (dollars < 0.01) return `$${dollars.toFixed(4)}`
  return `$${dollars.toFixed(2)}`
}

interface StatProps {
  icon: React.ReactNode
  label: string
  value: string
  muted?: boolean
  title?: string
}

function Stat({ icon, label, value, muted, title }: StatProps) {
  return (
    <div className={styles.stat} title={title}>
      <div className={styles.statIcon}>{icon}</div>
      <div className={styles.statBody}>
        <p className={styles.statLabel}>{label}</p>
        <p className={muted ? styles.statValueMuted : styles.statValue}>
          {value}
        </p>
      </div>
    </div>
  )
}

interface TotalsProps {
  totals: ActivityTotals
  hasActiveFilters: boolean
}

export function Totals({ totals, hasActiveFilters }: TotalsProps) {
  return (
    <div className={styles.totals}>
      <div className={styles.grid}>
        <Stat
          icon={<Receipt />}
          label="Runs"
          value={totals.count.toLocaleString()}
          title={hasActiveFilters ? 'Matching current filters' : 'All runs'}
        />
        <Stat
          icon={<Clock4 />}
          label="Total time"
          value={
            totals.totalDurationMs > 0
              ? formatDurationMs(totals.totalDurationMs)
              : '—'
          }
        />
        <Stat
          icon={<DollarSign />}
          label="Cost"
          value={
            totals.totalProviderCostCents > 0
              ? `${totals.totalsIncludeEstimates ? '~' : ''}${formatDollarsFromCents(totals.totalProviderCostCents)}`
              : '—'
          }
          title={
            totals.totalsIncludeEstimates
              ? "What FAL charged. A ~ means some runs are estimated from FAL's pricing table, because FAL's result carried no cost field."
              : 'What FAL actually charged.'
          }
        />
      </div>
      {totals.exceedsCap && (
        <p className={styles.cap}>
          Totals capped at the most recent 5,000 runs. Narrow with filters for
          precise numbers.
        </p>
      )}
    </div>
  )
}
