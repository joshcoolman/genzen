import { Settings } from 'lucide-react'
import type { GeneratorState } from '@/features/ai-images/hooks/use-generator'
import type { ModelSettingsState } from '@/features/ai-images/hooks/use-model-settings'
import type { PromptToolsState } from '@/features/ai-images/hooks/use-prompt-tools'
import type { CreditsState } from '@/features/credits/hooks/use-credits'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { ActionButton } from '@/components/ActionButton'
import { ImageSourceButtons } from '@/components/ImageSourceButtons'
import { SourceImagePreview } from '@/components/SourceImagePreview'
import { ModelCheckboxList } from '@/components/ModelCheckboxList'
import { ErrorBanner } from '@/components/ErrorBanner'
import { AspectRatioSelect } from '@/components/AspectRatioSelect'
import { PromptButton } from '@/components/PromptButton'
import { IMAGE_INPUT_MODELS } from '@/features/ai-images/models'
import { CREDIT_COSTS } from '@/features/credits'

interface UserImagesData {
  images: Array<{
    id: string
    title: string
    source: string
    storage_path: string
    [key: string]: unknown
  }>
  imageUrls: Record<string, string>
  isLoading: boolean
  refresh: () => Promise<void>
}

interface GeneratorPanelProps {
  generator: GeneratorState
  modelSettings: ModelSettingsState
  promptTools: PromptToolsState
  credits: CreditsState
  userImages: UserImagesData
  error: string | null
}

export function GeneratorPanel({
  generator,
  modelSettings,
  promptTools,
  credits,
  userImages,
  error,
}: GeneratorPanelProps) {
  return (
    <div className="bg-card rounded-lg p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Prompt */}
        <div className="space-y-3">
          {generator.sourceImage && (
            <SourceImagePreview
              src={generator.sourceImage.base64}
              name={generator.sourceImage.name}
              onRemove={generator.handleClearSourceImage}
            />
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
            <PromptButton
              onPrompt={promptTools.handleRandomPrompt}
              loading={promptTools.generatingPrompt}
              loadingText="Generating..."
              label="Prompt"
              disabled={
                promptTools.generatingPrompt || generator.inputMode === 'image'
              }
            />
            <ImageSourceButtons
              onFileSelected={generator.setSourceFile}
              library={{
                images: userImages.images,
                imageUrls: userImages.imageUrls,
                isLoading: userImages.isLoading,
                onSelect: (image) =>
                  generator.setSourceFromUrl(image.url, image.title),
                onOpen: userImages.refresh,
              }}
              className="contents"
            />
            <AspectRatioSelect
              orientation={generator.orientation}
              aspectRatio={generator.aspectRatio}
              onOrientationChange={generator.setOrientation}
              onAspectRatioChange={generator.setAspectRatio}
              disabled={generator.loading}
            />
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

          {error && <ErrorBanner message={error} />}
        </div>

        {/* Right Column: Model Selection */}
        <div className="space-y-2">
          {generator.inputMode === 'image' ? (
            <ModelCheckboxList
              models={IMAGE_INPUT_MODELS}
              selected={generator.imageSelectedModels}
              onToggle={generator.toggleImageModel}
              disabled={generator.loading}
              label={`Models — image input (${generator.imageSelectedModels.length} selected)`}
            />
          ) : (
            <ModelCheckboxList
              models={modelSettings.visibleModels}
              selected={modelSettings.selectedModels}
              onToggle={modelSettings.toggleSelectedModel}
              disabled={generator.loading}
              label={`Models (${modelSettings.selectedModels.length} selected)`}
              headerAction={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => modelSettings.setSettingsOpen(true)}
                  disabled={generator.loading}
                  title="Configure visible models"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              }
            />
          )}
        </div>
      </div>
    </div>
  )
}
