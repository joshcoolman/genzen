'use client'

import { useRef } from 'react'
import {
  ArrowDown,
  ArrowUp,
  CheckSquare,
  Info,
  Plus,
  Upload,
} from 'lucide-react'
import { ORIGIN_FILTERS, ORIGIN_FILTER_LABELS } from '../../_hooks/use-prefs'
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
  /** Select mode (#284). It took the slot the size switcher vacated. */
  selectMode: boolean
  onToggleSelectMode: () => void
  onUpload: (files: Array<File>) => void
  onGenerate: () => void
}

export function Toolbar({
  prefs,
  showGenerateButton,
  panelFloating,
  selectMode,
  onToggleSelectMode,
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

        {/* Loud when on, because a click means something different in select
            mode and the grid alone cannot say so. Not hidden on narrow
            viewports like the view toggles are: bulk delete is the reason
            selection exists, not a refinement. */}
        <button
          onClick={onToggleSelectMode}
          className={cx(styles.action, selectMode && styles.actionOn)}
          aria-pressed={selectMode}
          title={selectMode ? 'Leave select mode' : 'Select images'}
        >
          <CheckSquare className={styles.icon} />
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
