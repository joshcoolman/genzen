'use client'

import { Loader2, X } from 'lucide-react'
import styles from './rail-actions.module.css'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '#/components'
import { cx } from '#/lib/utils'

interface RailActionProps {
  icon: LucideIcon
  /** The full verb, e.g. "Create reference sheet". Shown in the tooltip. */
  label: string
  /** One word under the icon; the 64px rail has no room for the label. */
  caption: string
  onClick: () => void
  busy?: boolean
  disabled?: boolean
  danger?: boolean
  /** Rendered after the caption, where the drawer put it ("Trash 4"). */
  count?: number
}

export function RailAction({
  icon: Icon,
  label,
  caption,
  onClick,
  busy = false,
  disabled = false,
  danger = false,
  count,
}: RailActionProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<button type="button" />}
        onClick={onClick}
        disabled={disabled || busy}
        aria-busy={busy || undefined}
        className={cx(styles.action, danger && styles.danger)}
      >
        {busy ? (
          <Loader2 className={cx(styles.icon, styles.spinner)} aria-hidden />
        ) : (
          <Icon className={styles.icon} aria-hidden />
        )}
        <span className={styles.caption}>
          {count === undefined ? caption : `${caption} ${count}`}
        </span>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

interface RailActionsProps {
  count: number
  onClear: () => void
  children: ReactNode
}

/**
 * Select mode's desktop surface: the rail's nav items step aside and the verbs
 * for the selection take their place.
 *
 * The bar fixed to the bottom of the viewport (`SelectionDrawer`) was easy to
 * miss unless you already knew it was there; it is still the mobile
 * implementation, where there is no rail. The accent wash is the drawer's, so
 * the mode reads as the same colour it always did.
 */
export function RailActions({ count, onClear, children }: RailActionsProps) {
  return (
    <div className={styles.root}>
      <RailAction
        icon={X}
        label="Deselect all"
        caption="Deselect"
        count={count}
        onClick={onClear}
      />
      <div className={styles.divider} />
      {children}
    </div>
  )
}
