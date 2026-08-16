'use client'

import { Switch as BaseSwitch } from '@base-ui/react/switch'
import styles from './switch.module.css'
import type { ComponentProps } from 'react'
import { cx } from '#/lib/utils'

export interface SwitchProps extends Omit<
  ComponentProps<typeof BaseSwitch.Root>,
  'className'
> {
  className?: string
}

/**
 * A boolean control for a settings row.
 *
 * The component set had no such thing until #394: /images toggles its captions
 * and sort with lit icon buttons in the toolbar, which is right for a toolbar --
 * a row of icons where one is on -- and wrong beside a label, where the control
 * has to say which of two states it is in on its own.
 *
 * Deliberately plain. No label, no description, no row layout: the panel that
 * renders one owns its own text, the way `Popover` owns no width.
 */
export function Switch({ className, ...props }: SwitchProps) {
  return (
    <BaseSwitch.Root className={cx(styles.root, className)} {...props}>
      <BaseSwitch.Thumb className={styles.thumb} />
    </BaseSwitch.Root>
  )
}
