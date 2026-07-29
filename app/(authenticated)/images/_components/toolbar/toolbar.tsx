'use client'

import { useRef } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Info,
  LayoutGrid,
  Plus,
  Upload,
} from 'lucide-react'
import { THUMB_LABELS } from '../../_hooks/use-prefs'
import styles from './toolbar.module.css'
import type { PrefsState } from '../../_hooks/use-prefs'
import { cx } from '#/lib/utils'

interface ToolbarProps {
  prefs: PrefsState
  /** Hidden while the generator is already showing. */
  showGenerateButton: boolean
  onUpload: (files: Array<File>) => void
  onGenerate: () => void
}

export function Toolbar({
  prefs,
  showGenerateButton,
  onUpload,
  onGenerate,
}: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className={styles.toolbar}>
      <span className={styles.heading}>Images</span>
      <div className={styles.tools}>
        <button
          onClick={prefs.cycleThumbSize}
          className={cx(styles.viewToggle, styles.thumbSizeToggle)}
          aria-label={`Thumbnail size: ${THUMB_LABELS[prefs.thumbSize]}`}
        >
          <LayoutGrid className={styles.smallIcon} />
          <span className={styles.thumbSizeLabel}>
            {THUMB_LABELS[prefs.thumbSize]}
          </span>
        </button>

        <button
          onClick={prefs.toggleSort}
          className={styles.viewToggle}
          aria-label={prefs.sortAsc ? 'Sort oldest first' : 'Sort newest first'}
        >
          {prefs.sortAsc ? (
            <ArrowUp className={styles.icon} />
          ) : (
            <ArrowDown className={styles.icon} />
          )}
        </button>

        <button
          onClick={prefs.toggleInfo}
          className={cx(
            styles.viewToggle,
            prefs.showInfo && styles.viewToggleOn,
          )}
          aria-label={prefs.showInfo ? 'Hide info' : 'Show info'}
        >
          <Info className={styles.icon} />
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className={styles.fileInput}
          onChange={(e) => {
            const files = Array.from(e.target.files ?? [])
            if (files.length > 0) onUpload(files)
            e.target.value = ''
          }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className={styles.action}
          title="Upload image"
        >
          <Upload className={styles.icon} />
        </button>

        {showGenerateButton && (
          <button
            onClick={onGenerate}
            className={cx(styles.action, styles.actionPrimary)}
            title="New generation"
          >
            <Plus className={styles.icon} />
          </button>
        )}
      </div>
    </div>
  )
}
