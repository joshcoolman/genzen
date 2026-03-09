import { cn } from '@/lib/utils'

interface EmptyStateCardProps {
  children: React.ReactNode
  className?: string
}

export function EmptyStateCard({ children, className }: EmptyStateCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-dashed border-border bg-muted/30 py-12 text-center',
        className,
      )}
    >
      {children}
    </div>
  )
}
