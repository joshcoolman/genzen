'use client'

import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  EyeOff,
  Info,
  LayoutGrid,
  Plus,
  RotateCcw,
  Unlink,
} from 'lucide-react'
import { CircularIconButton } from '../circular-icon-button/circular-icon-button'
import { THUMB_LABELS } from '../../_hooks/use-prefs'
import styles from './toolbar.module.css'
import type { PrefsState } from '../../_hooks/use-prefs'
import { cx } from '#/lib/utils'

export interface ToolbarProps {
  prefs: PrefsState
  isMobile: boolean
  panelOpen: boolean
  onOpenPanel: () => void
  isChained: boolean
  onReset: () => void
  hasParent: boolean
  onDetach: () => void
}

export function Toolbar({
  prefs,
  isMobile,
  panelOpen,
  onOpenPanel,
  isChained,
  onReset,
  hasParent,
  onDetach,
}: ToolbarProps) {
  const openPanelButton = !panelOpen && (
    <button
      onClick={onOpenPanel}
      className={styles.openPanel}
      title="Open edit panel"
    >
      <Plus className={styles.icon} />
    </button>
  )

  return (
    <div className={styles.root}>
      <CircularIconButton
        icon={ArrowLeft}
        to="/images"
        title="Back to Images"
      />

      {/* Mobile gets the generate button only; the view controls need the room. */}
      {isMobile ? (
        openPanelButton
      ) : (
        <div className={styles.tools}>
          <div className={styles.toggles}>
            <button
              onClick={prefs.toggleThumbSize}
              className={cx(styles.toggle, styles.thumbSizeToggle)}
              aria-label={`Thumbnail size: ${THUMB_LABELS[prefs.thumbSize]}`}
            >
              <LayoutGrid className={styles.smallIcon} />
              <span className={styles.thumbSizeLabel}>
                {THUMB_LABELS[prefs.thumbSize]}
              </span>
            </button>
            <button
              onClick={prefs.toggleSort}
              className={styles.toggle}
              aria-label={
                prefs.sortAsc ? 'Sort newest first' : 'Sort oldest first'
              }
            >
              {prefs.sortAsc ? (
                <ArrowUp className={styles.icon} />
              ) : (
                <ArrowDown className={styles.icon} />
              )}
            </button>
            <button
              onClick={prefs.toggleInfo}
              className={styles.toggle}
              aria-label={prefs.showInfo ? 'Hide info' : 'Show info'}
            >
              {prefs.showInfo ? (
                <Info className={styles.icon} />
              ) : (
                <EyeOff className={styles.icon} />
              )}
            </button>
          </div>

          {isChained && (
            <button onClick={onReset} className={styles.textAction}>
              <RotateCcw className={styles.smallIcon} />
              Reset
            </button>
          )}
          {hasParent && (
            <button onClick={onDetach} className={styles.textAction}>
              <Unlink className={styles.smallIcon} />
              Detach
            </button>
          )}
          {openPanelButton}
        </div>
      )}
    </div>
  )
}
