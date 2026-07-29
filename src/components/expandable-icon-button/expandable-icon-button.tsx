import { forwardRef } from 'react'
import styles from './expandable-icon-button.module.css'
import type { ReactNode } from 'react'
import { cx } from '#/lib/utils'

interface ExpandableIconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode
  label: string
  variant?: 'default' | 'destructive'
}

export const ExpandableIconButton = forwardRef<
  HTMLButtonElement,
  ExpandableIconButtonProps
>(function ExpandableIconButton(
  { icon, label, variant = 'default', onClick, className, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.(e)
      }}
      {...rest}
      // Merged, not spread over: `{...rest}` used to sit after this, so any
      // caller className -- including the undefined one a Base UI `render`
      // passes down -- silently erased the button's own layout.
      className={cx(styles.root, className)}
    >
      <span
        className={cx(
          styles.pill,
          variant === 'destructive' && styles.pillDestructive,
        )}
      >
        {icon}
      </span>
    </button>
  )
})
