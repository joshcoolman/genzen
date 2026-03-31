import { useMemo } from 'react'
import type { useCanvasGenerate } from '../hooks/use-canvas-generate'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { GeneratorPanel } from '@/features/ai-images/components/GeneratorPanel'

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
      <DialogContent
        className="w-[380px] sm:max-w-[380px]"
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle className="text-sm font-medium text-zinc-300">
            Generate from Image
          </DialogTitle>
        </DialogHeader>

        <GeneratorPanel
          generator={generatorOverride}
          modelSelector={canvasGen.modelSelector}
          credits={canvasGen.credits}
          userImages={canvasGen.userImages}
          error={canvasGen.error}
        />
      </DialogContent>
    </Dialog>
  )
}
