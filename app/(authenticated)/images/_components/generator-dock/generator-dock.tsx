'use client'

import { GeneratorPanel } from '../../../_components/generator-panel/generator-panel'
import { SystemInstructionsButton } from '../../../_components/system-instructions-button/system-instructions-button'
import styles from './generator-dock.module.css'
import type { DockState } from '../../_hooks/use-dock'
import type { GeneratorState } from '#/features/ai-images/hooks/use-generator'
import type { useModelSelector } from '#/features/ai-images/model-selector/use-model-selector'
import type { UserImage } from '#/features/user-images/types'
import { Dialog, DialogContent, MobileDialogHeader } from '#/components'
import { cx } from '#/lib/utils'

interface GeneratorDockProps {
  dock: DockState
  isMobile: boolean
  /** A selection is up: the panel steps back rather than competing with it. */
  selectionActive?: boolean
  generator: GeneratorState
  modelSelector: ReturnType<typeof useModelSelector>
  userImages: {
    images: Array<UserImage>
    imageUrls: Record<string, string>
    isLoading: boolean
    refresh: () => Promise<void>
  }
  /** The open group, which an upload from the picker lands in (#549). */
  uploadGroupId?: string | null
  /** Opens the Shots dialog for the staged references (#553). */
  onShots?: () => void
  /** Opens the Lighting dialog for the staged references (#563). */
  onLighting?: () => void
}

/**
 * Where the generator sits: a full-screen dialog on mobile, and on desktop a
 * fixed right-hand column that pushes the gallery over.
 *
 * It could also float above the gallery, until the pin came out -- floating
 * covered the right-hand column of thumbnails to give the gallery back the
 * width it was covering, so it hid as much as it revealed. The X is the only
 * way to get the space back now, which is the honest one.
 */
export function GeneratorDock({
  dock,
  isMobile,
  selectionActive,
  generator,
  modelSelector,
  userImages,
  uploadGroupId,
  onShots,
  onLighting,
}: GeneratorDockProps) {
  const panel = (
    <GeneratorPanel
      generator={generator}
      modelSelector={modelSelector}
      userImages={userImages}
      uploadGroupId={uploadGroupId}
      onShots={onShots}
      onLighting={onLighting}
      modelDisplay={isMobile ? 'dropdown' : undefined}
    />
  )

  if (isMobile) {
    return (
      <Dialog open={dock.open} onOpenChange={dock.setOpen}>
        <DialogContent size="fullscreen" showCloseButton={false}>
          {/* The X stays here, unlike the desktop header: a full-screen dialog
              covers the sidebar that would otherwise close it. */}
          <MobileDialogHeader
            title="Generate"
            onClose={() => dock.setOpen(false)}
            action={<SystemInstructionsButton />}
          />
          <div className={styles.mobileBody}>{panel}</div>
        </DialogContent>
      </Dialog>
    )
  }

  if (!dock.open) return null

  return (
    <div className={cx(styles.panel, selectionActive && styles.stepBack)}>
      {/* No close button. An X on a panel that the sidebar toggles reads as
          "discard this", not "collapse this" -- and there is nothing here to
          discard, since the prompt and the staged set survive either way. The
          sidebar's own control is the honest one: the same switch going both
          directions. */}
      <div className={styles.header}>
        <span className={styles.title}>Generate</span>
        <SystemInstructionsButton />
      </div>
      {/* Inert, not merely dimmed: a dimmed panel that still takes clicks and
          Tab stops is a lie. The header stays live so the X can still close
          it. */}
      <div className={styles.body} inert={selectionActive}>
        {panel}
      </div>
    </div>
  )
}
