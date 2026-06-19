import styles from './SelectionActions.module.css'

interface SelectionActionsProps {
  count: number
  isGrouped: boolean
  onArrange: (cols: number) => void
  onGroup: (cols: number) => void
  onUngroup: () => void
  zoomPct: number
  onUpload: () => void
  onLibrary: () => void
  onCombine?: () => void
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
  onCombine,
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
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      </button>

      {/* Library button */}
      <button
        className={styles.iconBtn}
        onClick={onLibrary}
        title="Add from library"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
        </svg>
      </button>

      {/* Combine button -- 2-4 images selected */}
      {count >= 2 && count <= 4 && onCombine && (
        <button
          className={styles.iconBtn}
          onClick={onCombine}
          title="Combine images"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2" y="3" width="8" height="8" rx="1" />
            <rect x="14" y="3" width="8" height="8" rx="1" />
            <rect x="2" y="13" width="8" height="8" rx="1" />
            <path d="M14 17h8M18 13v8" />
          </svg>
        </button>
      )}

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
