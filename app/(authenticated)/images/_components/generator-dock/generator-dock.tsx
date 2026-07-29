'use client'

import { Pin, PinOff, X } from 'lucide-react'
import { GeneratorPanel } from '../../../_components/generator-panel/generator-panel'
import styles from './generator-dock.module.css'
import type { DockState } from '../../_hooks/use-dock'
import type { GeneratorState } from '#/features/ai-images/hooks/use-generator'
import type { useDescribeJson } from '#/features/ai-images/hooks/use-describe-json'
import type { useModelSelector } from '#/features/ai-images/model-selector/use-model-selector'
import type { UserImage } from '#/features/user-images/types'
import { Dialog, DialogContent, MobileDialogHeader } from '#/components'
import { cx } from '#/lib/utils'

interface GeneratorDockProps {
  dock: DockState
  isMobile: boolean
  generator: GeneratorState
  modelSelector: ReturnType<typeof useModelSelector>
  userImages: {
    images: Array<UserImage>
    imageUrls: Record<string, string>
    isLoading: boolean
    refresh: () => Promise<void>
  }
  describe: ReturnType<typeof useDescribeJson>
}

/**
 * Where the generator sits. Two placements, one panel: a full-screen dialog on
 * mobile, and on desktop a fixed right-hand column that is either pinned --
 * pushing the gallery over -- or floating above it behind a dismiss layer.
 */
export function GeneratorDock({
  dock,
  isMobile,
  generator,
  modelSelector,
  userImages,
  describe,
}: GeneratorDockProps) {
  const panel = (
    <GeneratorPanel
      generator={generator}
      modelSelector={modelSelector}
      userImages={userImages}
      describe={describe}
      modelDisplay={isMobile ? 'dropdown' : undefined}
    />
  )

  if (isMobile) {
    return (
      <Dialog open={dock.open} onOpenChange={dock.setOpen}>
        <DialogContent size="fullscreen" showCloseButton={false}>
          <MobileDialogHeader
            title="Generate"
            onClose={() => dock.setOpen(false)}
          />
          <div className={styles.mobileBody}>{panel}</div>
        </DialogContent>
      </Dialog>
    )
  }

  if (!dock.open) return null

  return (
    <>
      {!dock.pinned && (
        <div
          className={styles.dismissLayer}
          onClick={() => dock.setOpen(false)}
        />
      )}

      <div className={cx(styles.panel, !dock.pinned && styles.panelFloating)}>
        <div className={styles.header}>
          <span className={styles.title}>Generate</span>
          <div className={styles.headerActions}>
            <button
              onClick={dock.togglePinned}
              className={styles.headerButton}
              title={dock.pinned ? 'Unpin (overlay)' : 'Pin (inline)'}
            >
              {dock.pinned ? (
                <Pin className={styles.icon} />
              ) : (
                <PinOff className={styles.icon} />
              )}
            </button>
            <button
              onClick={() => dock.setOpen(false)}
              className={styles.headerButton}
            >
              <X className={styles.icon} />
            </button>
          </div>
        </div>
        <div className={styles.body}>{panel}</div>
      </div>
    </>
  )
}
