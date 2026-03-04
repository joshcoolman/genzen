import type { ReactNode } from 'react'

interface ImageGridProps {
  children: ReactNode
  className?: string
  size?: 'lg' | 'md' | 'sm'
  layout?: 'grid' | 'list'
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
        gap,
      }}
    >
      {children}
    </div>
  )
}
