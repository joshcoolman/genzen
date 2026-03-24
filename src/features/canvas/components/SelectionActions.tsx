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
  onGenerate?: () => void
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
  onGenerate,
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

      {/* Generate button -- single image selected */}
      {count === 1 && onGenerate && (
        <button
          className={styles.iconBtn}
          onClick={onGenerate}
          title="Generate from image"
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
            <path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z" />
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
