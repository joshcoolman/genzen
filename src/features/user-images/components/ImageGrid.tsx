/**
 * Image Grid Component
 *
 * Responsive grid layout for displaying image cards.
 */

import type { ReactNode } from 'react'

interface ImageGridProps {
  children: ReactNode
  className?: string
  size?: 'lg' | 'md' | 'sm'
}

/**
 * Responsive grid container for images
 */
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

/**
 * Empty state component
 */
export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border p-12 text-center">
      <div className="mb-4 text-4xl text-muted-foreground">No images</div>
      <h3 className="mb-2 text-lg font-semibold text-foreground">
        No images yet
      </h3>
      <p className="text-sm text-muted-foreground">
        Upload your first image to get started
      </p>
    </div>
  )
}
