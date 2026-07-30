'use client'

import styles from './context-menu.module.css'
import { cx } from '#/lib/utils'

interface ContextMenuProps {
  x: number
  y: number
  onGenerate: () => void
  onTrash: () => void
}

/** Right-click menu on a card: the same two actions the Generate pill and the
 *  delete modal offer, reachable without a selection. */
export function ContextMenu({ x, y, onGenerate, onTrash }: ContextMenuProps) {
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
        onClick={onTrash}
      >
        Move to Trash
      </button>
    </div>
  )
}
