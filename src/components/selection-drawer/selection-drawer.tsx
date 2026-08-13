import { Button } from '../button/button'
import styles from './selection-drawer.module.css'
import type { ReactNode } from 'react'

interface SelectionDrawerProps {
  count: number
  onClear: () => void
  children: ReactNode
}

/**
 * The bar that slides up when a list has a selection: a count, the verbs the
 * route supplies, and one way out.
 *
 * It sits on --z-drawer, which is below --z-dialog. It used to be `z-50`, the
 * same layer as a dialog, and only stayed under the confirm dialog it opens
 * because that renders later in the tree. Now it is under it by name.
 */
export function SelectionDrawer({
  count,
  onClear,
  children,
}: SelectionDrawerProps) {
  return (
    <div className={count > 0 ? styles.visible : styles.hidden}>
      {/* No "n selected" label: every verb here already carries the count, and
          the bar only exists when there is a selection. Deselect is one of the
          buttons rather than a quieter ghost beside them -- it is the way out,
          not a footnote. */}
      <div className={styles.bar}>
        <div className={styles.actions}>{children}</div>
        <Button size="sm" onClick={onClear}>
          Deselect all
        </Button>
      </div>
    </div>
  )
}
