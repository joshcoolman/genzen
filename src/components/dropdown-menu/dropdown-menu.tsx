'use client'

import { Menu } from '@base-ui/react/menu'
import styles from './dropdown-menu.module.css'
import type { ComponentProps, ReactNode } from 'react'

/**
 * A button-triggered menu. Four parts, where the shadcn version had fifteen:
 * its checkbox items, radio groups, submenus, shortcuts, labels and separators
 * had no consumer, and Base UI's `menu` has equivalents for all of them if one
 * ever turns up.
 *
 * Kept under shadcn's names, like Popover and Tooltip, so the one consumer
 * swaps by import.
 */
export function DropdownMenu(props: ComponentProps<typeof Menu.Root>) {
  return <Menu.Root {...props} />
}

/** Composes through `render`, not `asChild`. */
export function DropdownMenuTrigger(
  props: ComponentProps<typeof Menu.Trigger>,
) {
  return <Menu.Trigger {...props} />
}

type PositionerProps = ComponentProps<typeof Menu.Positioner>

export interface DropdownMenuContentProps {
  children: ReactNode
  className?: string
  /** @default 'center' */
  align?: PositionerProps['align']
  side?: PositionerProps['side']
  /** @default 4 */
  sideOffset?: number
  onClick?: ComponentProps<typeof Menu.Popup>['onClick']
}

export function DropdownMenuContent({
  children,
  className,
  align = 'center',
  side,
  sideOffset = 4,
  onClick,
}: DropdownMenuContentProps) {
  return (
    <Menu.Portal>
      <Menu.Positioner
        align={align}
        side={side}
        sideOffset={sideOffset}
        className={styles.positioner}
      >
        <Menu.Popup
          onClick={onClick}
          className={`${styles.popup} ${className ?? ''}`}
        >
          {children}
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  )
}

export function DropdownMenuItem({
  className,
  ...props
}: ComponentProps<typeof Menu.Item>) {
  return (
    <Menu.Item {...props} className={`${styles.item} ${className ?? ''}`} />
  )
}
