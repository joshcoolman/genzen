import {
  ImagePlus,
  RectangleHorizontal,
  RectangleVertical,
  Settings,
  Sparkles,
  X,
} from 'lucide-react'
import type { GeneratorState } from '@/features/ai-images/hooks/use-generator'
import type { ModelSettingsState } from '@/features/ai-images/hooks/use-model-settings'
import type { PromptToolsState } from '@/features/ai-images/hooks/use-prompt-tools'
import type { CreditsState } from '@/features/credits/hooks/use-credits'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { ActionButton } from '@/components/ActionButton'
import { IMAGE_INPUT_MODELS } from '@/features/ai-images/models'
import { CREDIT_COSTS } from '@/features/credits'

interface GeneratorPanelProps {
  generator: GeneratorState
  modelSettings: ModelSettingsState
  promptTools: PromptToolsState
  credits: CreditsState
  error: string | null
}

export function GeneratorPanel({
  generator,
  modelSettings,
  promptTools,
  credits,
  error,
}: GeneratorPanelProps) {
  return (
    <div className="bg-card rounded-lg p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Prompt */}
        <div className="space-y-3">
          <input
            ref={generator.fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={generator.handleFileChange}
          />

          {generator.sourceImage && (
            <div className="flex items-center gap-2 rounded border border-input bg-muted/50 px-2.5 py-1.5">
              <img
                src={generator.sourceImage.base64}
                alt="Source"
                className="h-10 w-10 rounded object-cover shrink-0"
              />
              <span className="text-xs text-muted-foreground truncate flex-1">
                {generator.sourceImage.name}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={generator.handleClearSourceImage}
                title="Remove source image"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          <Textarea
            id="prompt-textarea"
            placeholder={
              generator.describingImage
                ? 'Describing image...'
                : generator.inputMode === 'image'
                  ? 'Edit prompt (optional)...'
                  : 'Describe your image...'
            }
            value={generator.prompt}
            onChange={(e) => generator.setPrompt(e.target.value)}
            disabled={generator.loading || generator.describingImage}
            rows={generator.sourceImage ? 6 : 8}
          />

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={promptTools.handleRandomPrompt}
              disabled={
                promptTools.generatingPrompt || generator.inputMode === 'image'
              }
              title={
                generator.inputMode === 'image'
                  ? 'Not available in image mode'
                  : 'Generate a random prompt'
              }
              className="shrink-0"
            >
              <Sparkles className="h-4 w-4 mr-1.5" />
              {promptTools.generatingPrompt ? 'Generating...' : 'Prompt'}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => generator.fileInputRef.current?.click()}
              disabled={generator.loading}
              title="Upload source image"
              className={`shrink-0 ${generator.inputMode === 'image' ? 'border-primary text-primary' : ''}`}
            >
              <ImagePlus className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={generator.handleOrientationToggle}
              disabled={generator.loading}
              title={`Switch to ${generator.orientation === 'landscape' ? 'portrait' : 'landscape'}`}
              className="shrink-0"
            >
              {generator.orientation === 'landscape' ? (
                <RectangleHorizontal className="h-4 w-4" />
              ) : (
                <RectangleVertical className="h-4 w-4" />
              )}
            </Button>
            <Select
              value={generator.aspectRatio}
              onValueChange={generator.setAspectRatio}
              disabled={generator.loading}
            >
              <SelectTrigger className="w-24 shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {generator.ratioOptions.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ActionButton
              onClick={generator.handleGenerate}
              loading={generator.loading}
              loadingText={
                generator.activeModels.length > 1
                  ? `Generating ${generator.activeModels.length} images...`
                  : 'Generating...'
              }
              disabled={
                !generator.canGenerate ||
                (credits.balance ?? 0) < CREDIT_COSTS.image_gen
              }
              className="flex-1"
            >
              {credits.isEmpty
                ? 'Out of credits'
                : generator.activeModels.length > 1
                  ? `Generate ${generator.activeModels.length} images`
                  : 'Generate'}
            </ActionButton>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        {/* Right Column: Model Selection */}
        <div className="space-y-2">
          {generator.inputMode === 'image' ? (
            <>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-muted-foreground">
                  Models — image input ({generator.imageSelectedModels.length}{' '}
                  selected)
                </label>
              </div>
              <div className="space-y-1">
                {IMAGE_INPUT_MODELS.map((m) => (
                  <label
                    key={m.id}
                    className="flex items-center gap-2 rounded border border-input px-2.5 py-1.5 cursor-pointer hover:bg-accent/50 transition-colors"
                  >
                    <input
                      type="checkbox"
                      value={m.id}
                      checked={generator.imageSelectedModels.includes(m.id)}
                      onChange={(e) =>
                        generator.toggleImageModel(m.id, e.target.checked)
                      }
                      disabled={generator.loading}
                      className="h-3.5 w-3.5 cursor-pointer disabled:cursor-not-allowed"
                    />
                    <span className="text-xs font-medium">{m.name}</span>
                  </label>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-muted-foreground">
                  Models ({modelSettings.selectedModels.length} selected)
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => modelSettings.setSettingsOpen(true)}
                  disabled={generator.loading}
                  title="Configure visible models"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-1">
                {modelSettings.visibleModels.map((m) => (
                  <label
                    key={m.id}
                    className="flex items-center gap-2 rounded border border-input px-2.5 py-1.5 cursor-pointer hover:bg-accent/50 transition-colors"
                  >
                    <input
                      type="checkbox"
                      value={m.id}
                      checked={modelSettings.selectedModels.includes(m.id)}
                      onChange={(e) =>
                        modelSettings.toggleSelectedModel(
                          m.id,
                          e.target.checked,
                        )
                      }
                      disabled={generator.loading}
                      className="h-3.5 w-3.5 cursor-pointer disabled:cursor-not-allowed"
                    />
                    <span className="text-xs font-medium">{m.name}</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
