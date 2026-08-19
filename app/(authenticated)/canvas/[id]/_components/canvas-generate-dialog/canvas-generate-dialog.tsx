import { useMemo } from 'react'
import { GeneratorPanel } from '../../../../_components/generator-panel/generator-panel'
import { SystemInstructionsButton } from '../../../../_components/system-instructions-button/system-instructions-button'
import styles from './canvas-generate-dialog.module.css'
import type { useCanvasGenerate } from './use-canvas-generate'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '#/components'

interface CanvasGenerateDialogProps {
  canvasGen: ReturnType<typeof useCanvasGenerate>
}

export function CanvasGenerateDialog({ canvasGen }: CanvasGenerateDialogProps) {
  // Override handleGenerate so GeneratorPanel triggers the optimistic flow
  const generatorOverride = useMemo(
    () => ({
      ...canvasGen.generator,
      handleGenerate: () => {
        return Promise.resolve(canvasGen.handleGenerateOptimistic())
      },
    }),
    [canvasGen.generator, canvasGen.handleGenerateOptimistic],
  )

  return (
    <Dialog
      open={canvasGen.isOpen}
      onOpenChange={(open) => !open && canvasGen.close()}
    >
      <DialogContent className={styles.popup} showCloseButton={false}>
        {/* The gear rides the title here as it does on the Images dock. Canvas
            renders the same panel, so the prefix applies here too; a header
            without it would leave that invisible on this route. */}
        <DialogHeader>
          {/* A row inside the header rather than a class flipping the header's
              own `flex-direction` -- that is a call-site module fighting a
              component module for ordering, which `MobileDialogHeader` exists
              to avoid. */}
          <div className={styles.titleRow}>
            <DialogTitle>Generate from Image</DialogTitle>
            <SystemInstructionsButton />
          </div>
        </DialogHeader>

        <GeneratorPanel
          generator={generatorOverride}
          modelSelector={canvasGen.modelSelector}
          userImages={canvasGen.userImages}
        />
      </DialogContent>
    </Dialog>
  )
}
