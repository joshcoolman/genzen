import styles from './image-grid.module.css'
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
        <div key={i} className={compact ? styles.cardCompact : styles.card}>
          <div className={styles.image} />
          {!compact && (
            <>
              <div className={styles.titleLine}>
                <div className={styles.titleBar} />
              </div>
              <div className={styles.body}>
                <span>--</span>
              </div>
              <div className={styles.footer}>
                <span>--</span>
                <span>--</span>
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
    return (
      <div className={`${styles.list} ${className}`.trim()}>{children}</div>
    )
  }

  const minWidth = size === 'sm' ? '80px' : size === 'md' ? '120px' : '220px'
  const gap = size === 'lg' ? '1rem' : '0.5rem'

  return (
    <div
      className={`${styles.grid} ${className}`.trim()}
      style={{
        gridTemplateColumns: `repeat(auto-fill, minmax(${minWidth}, 1fr))`,
        gap,
      }}
    >
      {children}
    </div>
  )
}
