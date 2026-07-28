import { LayoutGrid, Upload } from 'lucide-react'
import styles from './selection-actions.module.css'

interface SelectionActionsProps {
  count: number
  isGrouped: boolean
  onArrange: (cols: number) => void
  onGroup: (cols: number) => void
  onUngroup: () => void
  zoomPct: number
  onUpload: () => void
  onLibrary: () => void
}

const DEFAULT_COLUMNS = 4

export function SelectionActions({
  count,
  isGrouped,
  onArrange,
  onGroup,
  onUngroup,
  zoomPct,
  onUpload,
  onLibrary,
}: SelectionActionsProps) {
  const hasSelection = count >= 2

  return (
    <div className={styles.bar} onPointerDown={(e) => e.stopPropagation()}>
      {/* Upload button */}
      <button
        className={styles.iconBtn}
        onClick={onUpload}
        title="Upload images"
      >
        <Upload size={18} />
      </button>

      {/* Library button */}
      <button
        className={styles.iconBtn}
        onClick={onLibrary}
        title="Add from library"
      >
        <LayoutGrid size={18} />
      </button>

      {hasSelection && (
        <>
          <div className={styles.divider} />
          <span className={styles.label}>{count} selected</span>
          <div className={styles.divider} />

          <div className={styles.actions}>
            <button
              className={styles.actionBtn}
              onClick={() => onArrange(DEFAULT_COLUMNS)}
            >
              Arrange
            </button>
            {isGrouped ? (
              <button className={styles.actionBtn} onClick={onUngroup}>
                Ungroup
              </button>
            ) : (
              <button
                className={styles.actionBtn}
                onClick={() => onGroup(DEFAULT_COLUMNS)}
              >
                Group
              </button>
            )}
          </div>
        </>
      )}

      <div className={styles.divider} />

      {/* Zoom indicator */}
      <span className={styles.zoom}>{zoomPct}%</span>
    </div>
  )
}
