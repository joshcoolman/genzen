import { DollarSign } from 'lucide-react'
import type { ActivityTotals } from '#/features/activity/types'
import { StatBadge } from '#/components'

function formatDollarsFromCents(cents: number): string {
  const dollars = cents / 100
  if (dollars === 0) return '$0.00'
  if (dollars < 0.01) return `$${dollars.toFixed(4)}`
  return `$${dollars.toFixed(2)}`
}

/** The only total worth showing. Runs and total time were removed with the
 *  stat grid -- a count the pagination already states and a duration nobody
 *  acts on. */
export function CostBadge({ totals }: { totals: ActivityTotals }) {
  const hasCost = totals.totalProviderCostCents > 0
  return (
    <StatBadge
      icon={<DollarSign />}
      label="Cost"
      value={
        hasCost
          ? `${totals.totalsIncludeEstimates ? '~' : ''}${formatDollarsFromCents(totals.totalProviderCostCents)}`
          : '—'
      }
      title={
        totals.totalsIncludeEstimates
          ? "What FAL charged. A ~ means some runs are estimated from FAL's pricing table, because FAL's result carried no cost field."
          : 'What FAL actually charged.'
      }
    />
  )
}
