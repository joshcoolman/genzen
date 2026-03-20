import type { ReactNode } from 'react'

interface ImageGridProps {
  children: ReactNode
  className?: string
  size?: 'lg' | 'md' | 'sm'
  layout?: 'grid' | 'list'
}

export function ImageGridSkeleton({
  count = 12,
  size = 'lg',
  className = '',
}: {
  count?: number
  size?: 'lg' | 'md' | 'sm'
  className?: string
}) {
  const compact = size !== 'lg'
  return (
    <ImageGrid size={size} className={className}>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className={`overflow-hidden border border-border bg-card ${compact ? 'rounded-md' : 'rounded-lg'}`}
        >
          <div className="aspect-square bg-black" />
          {!compact && (
            <>
              <div className="px-4 pt-3 pb-1">
                <div className="h-[10px] w-1/3 rounded bg-muted/30" />
              </div>
              <div className="px-4 pt-1 pb-2" style={{ minHeight: '3.875rem' }}>
                <span className="text-[10px] text-muted-foreground/30">--</span>
              </div>
              <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground/30">
                <div className="flex justify-between">
                  <span>--</span>
                  <span>--</span>
                </div>
              </div>
            </>
          )}
        </div>
      ))}
    </ImageGrid>
  )
}

export function ImageGrid({
  children,
  className = '',
  size = 'lg',
  layout = 'grid',
}: ImageGridProps) {
  if (layout === 'list') {
    return <div className={`flex flex-col gap-2 ${className}`}>{children}</div>
  }

  const minWidth = size === 'sm' ? '80px' : size === 'md' ? '120px' : '220px'
  const gap = size === 'lg' ? '1rem' : '0.5rem'

  return (
    <div
      className={className}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(${minWidth}, 1fr))`,
        alignItems: 'start',
        gap,
      }}
    >
      {children}
    </div>
  )
}
