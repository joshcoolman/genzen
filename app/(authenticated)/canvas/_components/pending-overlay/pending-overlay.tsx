'use client'

import styles from './pending-overlay.module.css'

interface PendingOverlayProps {
  left: number
  top: number
  /** Omitted when zoomed too far out to read it. */
  modelName?: string
}

/** Spinner centred on a pending tile, in screen space so it stays readable at
 *  any zoom -- the grey placeholder underneath scales with the tile instead. */
export function PendingOverlay({ left, top, modelName }: PendingOverlayProps) {
  return (
    <div className={styles.pendingOverlay} style={{ left, top }}>
      <div className={styles.pendingSpinner} />
      {modelName && <span className={styles.pendingModel}>{modelName}</span>}
    </div>
  )
}
