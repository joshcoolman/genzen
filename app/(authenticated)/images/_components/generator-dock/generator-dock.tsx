'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { GeneratorPanel } from '../../../_components/generator-panel/generator-panel'
import { SystemInstructionsButton } from '../../../_components/system-instructions-button/system-instructions-button'
import styles from './generator-dock.module.css'
import type { DockState } from '../../_hooks/use-dock'
import type { GeneratorState } from '#/features/ai-images/hooks/use-generator'
import type { useModelSelector } from '#/features/ai-images/model-selector/use-model-selector'
import type { UserImage } from '#/features/user-images/types'
import type { ReactNode } from 'react'
import { MobileDialogHeader, Sheet, SheetContent } from '#/components'
import { cx } from '#/lib/utils'

interface GeneratorDockProps {
  dock: DockState
  isMobile: boolean
  /** A selection is up, and the column is too narrow to hand over: the panel
   *  steps back rather than competing with the bottom drawer. */
  selectionActive?: boolean
  /** A selection is up and the column is wide enough: these take the column,
   *  in place of the generator (#587). */
  selectionActions?: ReactNode
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
  /** A run was just submitted from the phone's sheet, which has closed. */
  onMobileSubmit?: () => void
}

/**
 * Where the generator sits: on a phone, a sheet from the bottom behind a
 * floating plus (#753); on desktop a fixed right-hand column that pushes the
 * gallery over.
 *
 * **The phone does not share `dock.open`.** That is a persisted desktop
 * preference, and it defaults to open -- on a phone it put a full-screen
 * generator over the wall on every load. The sheet is local state, closed
 * until the plus is pressed, and it closes itself on Generate so the pending
 * tiles are what you see next.
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
  selectionActions,
  generator,
  modelSelector,
  userImages,
  uploadGroupId,
  onShots,
  onMobileSubmit,
}: GeneratorDockProps) {
  const [sheetOpen, setSheetOpen] = useState(false)

  const panel = (
    <GeneratorPanel
      generator={generator}
      modelSelector={modelSelector}
      userImages={userImages}
      uploadGroupId={uploadGroupId}
      onShots={onShots}
      modelDisplay={isMobile ? 'dropdown' : undefined}
      onSubmit={
        isMobile
          ? () => {
              setSheetOpen(false)
              onMobileSubmit?.()
            }
          : undefined
      }
    />
  )

  if (isMobile) {
    return (
      <>
        <button
          type="button"
          className={styles.fab}
          aria-label="Generate"
          onClick={() => setSheetOpen(true)}
        >
          <Plus />
        </button>
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent
            side="bottom"
            className={styles.sheet}
            showCloseButton={false}
          >
            <MobileDialogHeader
              title="Generate"
              onClose={() => setSheetOpen(false)}
              action={<SystemInstructionsButton />}
            />
            <div className={styles.mobileBody}>{panel}</div>
          </SheetContent>
        </Sheet>
      </>
    )
  }

  /* The column exists for the selection even with the generator closed:
     otherwise select mode has no desktop surface for anyone who works with the
     generator hidden. */
  if (selectionActions) {
    return <div className={styles.panel}>{selectionActions}</div>
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
