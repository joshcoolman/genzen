'use client'

import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip'
import styles from './tooltip.module.css'
import type { ComponentProps, ReactNode } from 'react'

/**
 * A hover/focus label. The parts mirror shadcn's names (`TooltipContent`, not
 * `TooltipPopup`) so the remaining consumers swap by import, and `Content`
 * collapses Portal + Positioner + Popup + Arrow the way shadcn's did.
 *
 * One API difference that does not survive a rename: the Provider's delay prop
 * is `delay`, not `delayDuration`.
 */
export function TooltipProvider(
  props: ComponentProps<typeof BaseTooltip.Provider>,
) {
  return <BaseTooltip.Provider {...props} />
}

export function Tooltip(props: ComponentProps<typeof BaseTooltip.Root>) {
  return <BaseTooltip.Root {...props} />
}

/** Composes through `render`, not `asChild`. */
export function TooltipTrigger(
  props: ComponentProps<typeof BaseTooltip.Trigger>,
) {
  return <BaseTooltip.Trigger {...props} />
}

export interface TooltipContentProps {
  children: ReactNode
  className?: string
  /** @default 'top' */
  side?: ComponentProps<typeof BaseTooltip.Positioner>['side']
  /** @default 6 */
  sideOffset?: number
}

export function TooltipContent({
  children,
  className,
  side = 'top',
  sideOffset = 6,
}: TooltipContentProps) {
  return (
    <BaseTooltip.Portal>
      <BaseTooltip.Positioner side={side} sideOffset={sideOffset}>
        <BaseTooltip.Popup className={`${styles.popup} ${className ?? ''}`}>
          <BaseTooltip.Arrow className={styles.arrow} />
          {children}
        </BaseTooltip.Popup>
      </BaseTooltip.Positioner>
    </BaseTooltip.Portal>
  )
}
