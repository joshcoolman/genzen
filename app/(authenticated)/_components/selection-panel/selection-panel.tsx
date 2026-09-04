'use client'

import styles from './selection-panel.module.css'
import type { ReactNode } from 'react'
import { Button } from '#/components'
import { useIsMobile } from '#/lib/use-is-mobile'

/**
 * Below this the generator column and a usable grid cannot both fit, so select
 * mode falls back to `SelectionDrawer`. It is video's column-stacking width,
 * which is the same question asked once already.
 */
const SELECTION_PANEL_MIN_WIDTH = 960

/** Whether the right-hand column is worth taking over at this width. */
export function useSelectionPanelFits() {
  return !useIsMobile(SELECTION_PANEL_MIN_WIDTH)
}

interface SelectionPanelProps {
  count: number
  onClear: () => void
  /** The route's verbs. The same `<Button>`s the drawer takes. */
  children: ReactNode
}

/**
 * Select mode's wide surface: the verbs for the selection take over the
 * right-hand column, in place of the generator.
 *
 * The bar fixed to the bottom of the viewport (`SelectionDrawer`) is easy to
 * miss unless you already know it is there -- it sits in peripheral vision
 * while you are looking at the grid, which is the one place you are not
 * looking. The column is where the controls for this page already are.
 *
 * Layout only, like the drawer: it takes `children` and never learns what a
 * verb is. Routes hand the same fragment to both surfaces, so there is one
 * list of verbs and two places it can appear.
 */
export function SelectionPanel({
  count,
  onClear,
  children,
}: SelectionPanelProps) {
  return (
    /* The empty column below the verbs clears the selection, the way the empty
       space under the grid does (#439). Compared by identity rather than by
       what bubbles up: every button in here bubbles, and a handler that fired
       for those would clear the selection on the very clicks that use it. */
    <div
      className={styles.root}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClear()
      }}
    >
      {/* Deselect is text opposite the count, not a button among the verbs:
          the column is a list of things to do to the selection, and leaving is
          not one of them. Escape and a click on the background do the same. */}
      <div className={styles.header}>
        <span className={styles.title}>{count} selected</span>
        <Button
          variant="secondary"
          size="sm"
          className={styles.deselect}
          onClick={onClear}
        >
          Deselect
        </Button>
      </div>
      <div className={styles.actions}>{children}</div>
    </div>
  )
}
