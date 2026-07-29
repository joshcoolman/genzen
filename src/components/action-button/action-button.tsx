import * as React from 'react'
import { Loader2 } from 'lucide-react'
import styles from './action-button.module.css'
import { cx } from '#/lib/utils'

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean
  loadingText?: string
  icon?: React.ReactNode
  variant?: 'default' | 'outline'
}

export function ActionButton({
  children,
  loading = false,
  loadingText,
  icon,
  variant = 'default',
  disabled,
  className,
  ...props
}: ActionButtonProps) {
  const isDisabled = disabled || loading

  return (
    <button
      disabled={isDisabled}
      className={cx(
        styles.root,
        isDisabled ? styles.disabled : styles[variant],
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className={styles.spinner} /> : icon ? icon : null}
      {loading ? (loadingText ?? children) : children}
    </button>
  )
}
