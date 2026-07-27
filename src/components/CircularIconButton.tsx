'use client'

import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { cn } from '#/lib/utils'

interface CircularIconButtonProps {
  icon: LucideIcon
  onClick?: () => void
  to?: string
  title?: string
  variant?: 'white' | 'primary'
  className?: string
}

/**
 * Circular icon button with white or primary variant
 * Can be a button or Link depending on `to` prop
 */
export function CircularIconButton({
  icon: Icon,
  onClick,
  to,
  title,
  variant = 'white',
  className,
}: CircularIconButtonProps) {
  const baseClasses =
    'flex h-9 w-9 items-center justify-center rounded-full transition-colors'
  const variantClasses = {
    white: 'bg-white/10 text-white hover:bg-white/20',
    primary: 'bg-accent-brand text-white hover:bg-accent-brand/90',
  }

  const combinedClasses = cn(baseClasses, variantClasses[variant], className)

  if (to) {
    return (
      <Link href={to} className={combinedClasses} title={title}>
        <Icon className="h-4 w-4" />
      </Link>
    )
  }

  return (
    <button onClick={onClick} className={combinedClasses} title={title}>
      <Icon className="h-4 w-4" />
    </button>
  )
}
