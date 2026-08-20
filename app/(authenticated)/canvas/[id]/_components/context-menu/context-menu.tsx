'use client'

import styles from './context-menu.module.css'
import { cx } from '#/lib/utils'

interface ContextMenuProps {
  x: number
  y: number
  onGenerate: () => void
  onRemove: () => void
}

/** Right-click menu on a card: Generate, and take it off the board, reachable
 *  without a selection. */
export function ContextMenu({ x, y, onGenerate, onRemove }: ContextMenuProps) {
  return (
    <div
      className={styles.contextMenu}
      style={{ left: x, top: y }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button className={styles.contextMenuItem} onClick={onGenerate}>
        Generate
      </button>
      <button
        className={cx(styles.contextMenuItem, styles.contextMenuItemDanger)}
        onClick={onRemove}
      >
        Remove from Canvas
      </button>
    </div>
  )
}
