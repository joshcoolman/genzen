import { COMBINE_MODELS } from '../hooks/use-canvas-combine'
import type { useCanvasCombine } from '../hooks/use-canvas-combine'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { ActionButton } from '@/components/ActionButton'
import { AspectRatioSelect } from '@/components/AspectRatioSelect'
import { ErrorBanner } from '@/components/ErrorBanner'
import { NumberStepper } from '@/components/NumberStepper'
import { CREDIT_COSTS } from '@/features/credits'

interface CanvasCombineDialogProps {
  canvasCombine: ReturnType<typeof useCanvasCombine>
}

export function CanvasCombineDialog({
  canvasCombine: cc,
}: CanvasCombineDialogProps) {
  const canGenerate = cc.prompt.trim().length > 0 && cc.sourceImages.length > 0
  const totalImages = cc.selectedModels.length * cc.runsCount

  return (
    <Dialog open={cc.isOpen} onOpenChange={(open) => !open && cc.close()}>
      <DialogContent
        className="w-[380px] sm:max-w-[380px]"
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle className="text-sm font-medium text-zinc-300">
            Combine Images
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Thumbnail grid with label inputs */}
          <div className="grid grid-cols-4 gap-2">
            {cc.sourceImages.map((img, i) => (
              <div key={img.id} className="flex flex-col gap-1">
                <div className="aspect-square w-full overflow-hidden rounded bg-muted">
                  {img.signedUrl && (
                    <img
                      src={img.signedUrl}
                      alt={`Image ${i + 1}`}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <input
                  type="text"
                  value={cc.labels[img.id] ?? ''}
                  onChange={(e) => cc.setLabel(img.id, e.target.value)}
                  placeholder="label..."
                  className="w-full rounded border border-input bg-transparent px-1.5 py-0.5 text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            ))}
          </div>

          {/* Aspect ratio */}
          <AspectRatioSelect
            orientation={cc.orientation}
            aspectRatio={cc.aspectRatio}
            onOrientationChange={cc.setOrientation}
            onAspectRatioChange={cc.setAspectRatio}
            className="flex-1"
          />

          {/* Prompt */}
          <Textarea
            placeholder="Describe the composition..."
            value={cc.prompt}
            onChange={(e) => cc.setPrompt(e.target.value)}
            rows={4}
            className="text-xs"
          />

          {/* Model toggles */}
          <div className="flex gap-2">
            {COMBINE_MODELS.map((model) => {
              const active = cc.selectedModels.includes(model.id)
              return (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => cc.toggleModel(model.id)}
                  disabled={cc.isGenerating}
                  className={`flex-1 rounded-md border px-3 py-1.5 text-xs transition-colors disabled:opacity-50 ${
                    active
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-input text-muted-foreground hover:border-foreground hover:text-foreground'
                  }`}
                >
                  {model.name}
                </button>
              )
            })}
          </div>

          {/* Generate button + run count */}
          <div className="flex gap-2 items-center">
            <ActionButton
              onClick={() => {
                const cost = CREDIT_COSTS.variation * totalImages
                if ((cc.credits.balance ?? 0) < cost) {
                  cc.credits.showInsufficientCredits(cost)
                  return
                }
                void cc.handleCombineOptimistic()
              }}
              loading={cc.isGenerating}
              loadingText={`Generating ${totalImages} images...`}
              disabled={!canGenerate && !cc.credits.isEmpty}
              className="flex-1"
            >
              {cc.credits.isEmpty
                ? 'Out of credits'
                : totalImages > 1
                  ? `Generate ${totalImages} images`
                  : 'Generate'}
            </ActionButton>
            <NumberStepper
              value={cc.runsCount}
              min={1}
              max={2}
              onAdjust={cc.adjustRuns}
              disabled={cc.isGenerating}
            />
          </div>

          {cc.error && <ErrorBanner message={cc.error} />}
        </div>
      </DialogContent>
    </Dialog>
  )
}
