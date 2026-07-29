'use client'

import { Popover as BasePopover } from '@base-ui/react/popover'
import styles from './popover.module.css'
import type { ComponentProps, ReactNode } from 'react'

/**
 * A click-triggered floating panel. Parts mirror shadcn's names
 * (`PopoverContent`, not `PopoverPopup`), and `Content` collapses
 * Portal + Positioner + Popup the way shadcn's did.
 *
 * Four of shadcn's seven parts are gone: `Anchor` had no consumer, and
 * `Header`/`Title`/`Description` were three divs' worth of typography that
 * nothing used either. Base UI has real `Title`/`Description` parts if a
 * labelled popover ever turns up -- reach for those rather than reviving these.
 */
export function Popover(props: ComponentProps<typeof BasePopover.Root>) {
  return <BasePopover.Root {...props} />
}

/** Composes through `render`, not `asChild`. */
export function PopoverTrigger(
  props: ComponentProps<typeof BasePopover.Trigger>,
) {
  return <BasePopover.Trigger {...props} />
}

type PositionerProps = ComponentProps<typeof BasePopover.Positioner>

export interface PopoverContentProps {
  children: ReactNode
  /** The panel's own look: width, padding, max-height. It has none by default. */
  className?: string
  /** @default 'center' */
  align?: PositionerProps['align']
  side?: PositionerProps['side']
  /** @default 4 */
  sideOffset?: number
  collisionPadding?: PositionerProps['collisionPadding']
}

export function PopoverContent({
  children,
  className,
  align = 'center',
  side,
  sideOffset = 4,
  collisionPadding,
}: PopoverContentProps) {
  return (
    <BasePopover.Portal>
      <BasePopover.Positioner
        align={align}
        side={side}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={styles.positioner}
      >
        <BasePopover.Popup className={`${styles.popup} ${className ?? ''}`}>
          {children}
        </BasePopover.Popup>
      </BasePopover.Positioner>
    </BasePopover.Portal>
  )
}
