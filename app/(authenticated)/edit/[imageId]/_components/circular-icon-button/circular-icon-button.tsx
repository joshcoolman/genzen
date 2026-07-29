'use client'

import Link from 'next/link'
import styles from './circular-icon-button.module.css'
import type { LucideIcon } from 'lucide-react'
import { cx } from '#/lib/utils'

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
  const combinedClasses = cx(styles.root, styles[variant], className)

  if (to) {
    return (
      <Link href={to} className={combinedClasses} title={title}>
        <Icon className={styles.icon} />
      </Link>
    )
  }

  return (
    <button onClick={onClick} className={combinedClasses} title={title}>
      <Icon className={styles.icon} />
    </button>
  )
}
