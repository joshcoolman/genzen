import { Clock4, DollarSign, Receipt, Zap } from 'lucide-react'
import type { ActivityTotals as Totals } from '../types'
import { formatDurationMs } from '@/lib/time-format'

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
    <div
      className="flex items-center gap-3 rounded-md border border-border bg-card px-4 py-3"
      title={title}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-muted/60 text-muted-foreground">
        {icon}
      </div>
      <div className="min-w-0 flex-col">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p
          className={
            muted
              ? 'text-sm text-muted-foreground tabular-nums'
              : 'text-lg font-semibold tabular-nums text-foreground'
          }
        >
          {value}
        </p>
      </div>
    </div>
  )
}

interface ActivityTotalsProps {
  totals: Totals
  hasActiveFilters: boolean
}

export function ActivityTotals({
  totals,
  hasActiveFilters,
}: ActivityTotalsProps) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat
          icon={<Receipt className="h-4 w-4" />}
          label="Runs"
          value={totals.count.toLocaleString()}
          title={hasActiveFilters ? 'Matching current filters' : 'All runs'}
        />
        <Stat
          icon={<Clock4 className="h-4 w-4" />}
          label="Total time"
          value={
            totals.totalDurationMs > 0
              ? formatDurationMs(totals.totalDurationMs)
              : '—'
          }
        />
        <Stat
          icon={<DollarSign className="h-4 w-4" />}
          label="You paid"
          value={formatDollarsFromCents(totals.totalUserCostCents)}
        />
        <Stat
          icon={<Zap className="h-4 w-4" />}
          label="Provider cost"
          value={
            totals.totalProviderCostCents > 0
              ? formatDollarsFromCents(totals.totalProviderCostCents)
              : '—'
          }
          muted
          title="Raw provider cost where available (FAL). Direct Google/OpenAI shows blank until pricing tables are added."
        />
      </div>
      {totals.exceedsCap && (
        <p className="text-[11px] text-muted-foreground">
          Totals capped at the most recent 5,000 runs. Narrow with filters for
          precise numbers.
        </p>
      )}
    </div>
  )
}
