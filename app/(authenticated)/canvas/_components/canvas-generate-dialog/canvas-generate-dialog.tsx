import { useMemo } from 'react'
import { GeneratorPanel } from '../../../_components/generator-panel/generator-panel'
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
        <DialogHeader>
          <DialogTitle>Generate from Image</DialogTitle>
        </DialogHeader>

        <GeneratorPanel
          generator={generatorOverride}
          modelSelector={canvasGen.modelSelector}
          userImages={canvasGen.userImages}
          hideSourceButtons
          hidePastePrompts
          hideGeneratePrompts
        />
      </DialogContent>
    </Dialog>
  )
}
