import { cn } from '@/lib/utils'

interface Stat {
  label: string
  value: string
  detail?: string
  labelClassName?: string
  valueClassName?: string
}

interface StatsRowProps {
  stats: Array<Stat>
  className?: string
}

export function StatsRow({ stats, className }: StatsRowProps) {
  return (
    <div className={cn('rounded-lg border border-border bg-card', className)}>
      <div
        className="grid divide-x divide-border"
        style={{ gridTemplateColumns: `repeat(${stats.length}, 1fr)` }}
      >
        {stats.map((stat) => (
          <div key={stat.label} className="p-6">
            <p
              className={cn(
                'text-xs text-muted-foreground font-medium uppercase tracking-wider',
                stat.labelClassName,
              )}
            >
              {stat.label}
            </p>
            <p
              className={cn(
                'text-3xl font-medium tabular-nums mt-2',
                stat.valueClassName,
              )}
            >
              {stat.value}
            </p>
            {stat.detail && (
              <p className="text-xs text-muted-foreground mt-2">
                {stat.detail}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
