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
import {
  ORIGIN_FILTERS,
  ORIGIN_FILTER_LABELS,
  THUMB_LABELS,
} from '../../_hooks/use-prefs'
import styles from './toolbar.module.css'
import type { PrefsState } from '../../_hooks/use-prefs'
import { SingleSelect } from '#/components'
import { cx } from '#/lib/utils'

interface ToolbarProps {
  prefs: PrefsState
  /** Hidden while the generator is already showing. */
  showGenerateButton: boolean
  /** The generator is open but unpinned, so it floats over this row's right
   *  edge. Without the reserved space the tools sit under it -- the defect
   *  `images/CLAUDE.md` carried as known. */
  panelFloating: boolean
  onUpload: (files: Array<File>) => void
  onGenerate: () => void
}

export function Toolbar({
  prefs,
  showGenerateButton,
  panelFloating,
  onUpload,
  onGenerate,
}: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className={cx(styles.toolbar, panelFloating && styles.inset)}>
      <div className={styles.scope}>
        <span className={styles.heading}>Images</span>
        <SingleSelect
          options={ORIGIN_FILTERS.map((value) => ({
            value,
            label: ORIGIN_FILTER_LABELS[value],
          }))}
          value={prefs.originFilter}
          // SingleSelect clears on re-click; here "no scope" is `all`, so a
          // second click on the active pill widens rather than doing nothing.
          onChange={(value) => prefs.setOriginFilter(value ?? 'all')}
        />
      </div>
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
