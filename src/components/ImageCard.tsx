import type { ReactNode } from 'react'

interface ImageCardProps {
  src: string | null
  alt: string
  onClick: () => void
  objectFit?: 'contain' | 'cover'
  compact?: boolean
  dimmed?: boolean
  hoverBorder?: string
  asButton?: boolean
  children?: ReactNode
  footer?: ReactNode
  fallback?: ReactNode
}

export function ImageCard({
  src,
  alt,
  onClick,
  objectFit = 'contain',
  compact = false,
  dimmed = false,
  hoverBorder = 'hover:border-accent-brand/50',
  asButton = false,
  children,
  footer,
  fallback,
}: ImageCardProps) {
  const El = asButton ? 'button' : 'div'
  const bgClass = objectFit === 'contain' ? 'bg-black' : ''

  return (
    <El
      className={`group relative overflow-hidden border border-border bg-card transition-opacity cursor-pointer ${hoverBorder} flex flex-col ${
        compact ? 'rounded-md' : 'rounded-lg'
      } ${dimmed ? 'opacity-50' : ''}`}
      onClick={onClick}
    >
      <div className={`relative aspect-square overflow-hidden ${bgClass}`}>
        {src ? (
          <img
            src={src}
            alt={alt}
            className={`h-full w-full ${objectFit === 'cover' ? 'object-cover' : 'object-contain'}`}
          />
        ) : (
          (fallback ?? (
            <div className="h-full w-full flex items-center justify-center text-muted-foreground">
              Loading...
            </div>
          ))
        )}
        {children}
      </div>
      {footer}
    </El>
  )
}
