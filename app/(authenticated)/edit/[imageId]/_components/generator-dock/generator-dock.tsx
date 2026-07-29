'use client'

import { Pin, PinOff } from 'lucide-react'
import { GeneratorPanel } from '../../../../_components/generator-panel/generator-panel'
import styles from './generator-dock.module.css'
import type { ComponentProps } from 'react'
import { Button, Dialog, DialogContent, MobileDialogHeader } from '#/components'
import { cx } from '#/lib/utils'

export interface GeneratorDockProps extends Pick<
  ComponentProps<typeof GeneratorPanel>,
  | 'generator'
  | 'modelSelector'
  | 'userImages'
  | 'describe'
  | 'mode'
  | 'refImagesReadOnly'
  | 'libraryFilterIds'
> {
  isMobile: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  pinned: boolean
  onTogglePin: () => void
  variationsLoading: boolean
  onOpenVariations: () => void
}

/** The generator, docked. A right-hand sidebar on desktop and a full-screen
 *  dialog on mobile -- the same contents either way, which is the reason this
 *  is a component rather than two branches in the view. */
export function GeneratorDock({
  isMobile,
  open,
  onOpenChange,
  pinned,
  onTogglePin,
  variationsLoading,
  onOpenVariations,
  ...panel
}: GeneratorDockProps) {
  const contents = (
    <>
      <GeneratorPanel {...panel} />
      <Button
        variant="secondary"
        onClick={onOpenVariations}
        loading={variationsLoading}
        className={styles.variations}
      >
        {variationsLoading ? 'Generating...' : 'Generate Variations'}
      </Button>
    </>
  )

  if (isMobile) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent size="fullscreen" showCloseButton={false}>
          <MobileDialogHeader
            title="Edit"
            onClose={() => onOpenChange(false)}
          />
          <div className={styles.mobileBody}>{contents}</div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <div className={cx(styles.root, !pinned && styles.floating)}>
      <div className={styles.header}>
        <span className={styles.title}>Edit</span>
        <div className={styles.headerActions}>
          <button
            onClick={onTogglePin}
            className={styles.headerButton}
            title={pinned ? 'Unpin (overlay)' : 'Pin (inline)'}
          >
            {pinned ? (
              <Pin className={styles.smallIcon} />
            ) : (
              <PinOff className={styles.smallIcon} />
            )}
          </button>
        </div>
      </div>
      <div className={styles.body}>{contents}</div>
    </div>
  )
}
