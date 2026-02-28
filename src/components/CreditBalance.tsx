import { Link } from '@tanstack/react-router'
import { useCredits } from '@/features/credits/hooks/use-credits'
import { cn } from '@/lib/utils'

export function CreditBalance() {
  const credits = useCredits()

  if (credits.balance === null) return null

  return (
    <Link
      to="/dashboard/credits"
      className={cn(
        'text-sm tabular-nums hover:underline',
        credits.isEmpty
          ? 'text-red-500'
          : credits.isLow
            ? 'text-yellow-500'
            : 'text-muted-foreground',
      )}
    >
      {credits.balance} credits
    </Link>
  )
}
