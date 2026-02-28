import { cn } from '@/lib/utils'

interface SectionCardProps {
  title?: string
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
}

export function SectionCard({
  title,
  children,
  footer,
  className,
}: SectionCardProps) {
  return (
    <div className={cn('rounded-lg border border-border bg-card', className)}>
      {title && (
        <div className="px-6 pt-6 pb-0">
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
      )}
      <div className="p-6">{children}</div>
      {footer && (
        <div className="px-6 pb-6 pt-0 border-t border-border">
          <div className="pt-4">{footer}</div>
        </div>
      )}
    </div>
  )
}
