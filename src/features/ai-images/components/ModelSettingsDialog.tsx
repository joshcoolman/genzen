import type { ImageModel, ModelCategory } from '@/features/ai-images/models'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ALL_IMAGE_MODELS } from '@/features/ai-images/models'

interface ModelSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  visibleModels: Array<string>
  onSaveVisibleModels: (modelIds: Array<string>) => void
}

export function ModelSettingsDialog({
  open,
  onOpenChange,
  visibleModels,
  onSaveVisibleModels,
}: ModelSettingsDialogProps) {
  function toggleModel(modelId: string) {
    const newSelection = visibleModels.includes(modelId)
      ? visibleModels.filter((id) => id !== modelId)
      : [...visibleModels, modelId]

    // Don't allow deselecting the last model
    if (newSelection.length > 0) {
      onSaveVisibleModels(newSelection)
    }
  }

  // Group models by category
  const modelsByCategory: Record<ModelCategory, Array<ImageModel>> = {
    FLUX: [],
    Kling: [],
    Specialized: [],
    Other: [],
  }

  ALL_IMAGE_MODELS.forEach((model) => {
    modelsByCategory[model.category].push(model)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure Visible Models</DialogTitle>
          <DialogDescription>
            Select which models to show in the model selector. Changes are saved
            automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {(
            Object.entries(modelsByCategory) as Array<
              [ModelCategory, Array<ImageModel>]
            >
          ).map(([category, models]) => (
            <div key={category} className="space-y-1">
              <h3 className="text-xs font-semibold text-muted-foreground px-1 mb-1">
                {category}
              </h3>
              <div className="space-y-1">
                {models.map((model) => (
                  <label
                    key={model.id}
                    className="flex items-center gap-2 rounded border border-input px-2.5 py-1.5 cursor-pointer hover:bg-accent/50 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={visibleModels.includes(model.id)}
                      onChange={() => toggleModel(model.id)}
                      className="h-3.5 w-3.5 cursor-pointer rounded border-input"
                    />
                    <span className="text-xs font-medium">{model.name}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
