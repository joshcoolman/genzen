import { cn } from '@/lib/utils'

interface PlaceholderCardProps {
  gradient: string
  aspectRatio?: 'square' | 'video'
  label?: string
  selected?: boolean
  onClick?: () => void
  className?: string
}

export function PlaceholderCard({
  gradient,
  aspectRatio = 'square',
  label,
  selected,
  onClick,
  className,
}: PlaceholderCardProps) {
  const aspectClass = aspectRatio === 'video' ? 'aspect-video' : 'aspect-square'
  const Component = onClick ? 'button' : 'div'

  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        `${aspectClass} rounded-md bg-gradient-to-br ${gradient} relative`,
        onClick && 'cursor-pointer transition-all',
        selected && 'ring-2 ring-accent-brand ring-offset-2 ring-offset-card',
        onClick &&
          !selected &&
          'hover:ring-2 hover:ring-accent-brand hover:ring-offset-2 hover:ring-offset-card',
        className,
      )}
    >
      {label && (
        <span className="absolute bottom-2 left-2 rounded bg-background/80 px-2 py-0.5 text-xs font-medium">
          {label}
        </span>
      )}
    </Component>
  )
}
