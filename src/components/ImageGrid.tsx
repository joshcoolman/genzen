import type { ReactNode } from 'react'

interface ImageGridProps {
  children: ReactNode
  className?: string
  size?: 'lg' | 'md' | 'sm'
}

export function ImageGrid({
  children,
  className = '',
  size = 'lg',
}: ImageGridProps) {
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
