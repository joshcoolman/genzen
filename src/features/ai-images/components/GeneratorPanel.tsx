import type { GeneratorState } from '@/features/ai-images/hooks/use-generator'
import type { CreditsState } from '@/features/credits/hooks/use-credits'
import type { UnifiedModel } from '@/components/ModelSelector'
import { Textarea } from '@/components/ui/textarea'
import { ActionButton } from '@/components/ActionButton'
import { ImageSourceButtons } from '@/components/ImageSourceButtons'
import { SourceImagePreview } from '@/components/SourceImagePreview'
import { ModelFilterPills, ModelSelector } from '@/components/ModelSelector'
import { ModelCheckboxList } from '@/components/ModelCheckboxList'
import { ErrorBanner } from '@/components/ErrorBanner'
import { AspectRatioSelect } from '@/components/AspectRatioSelect'
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

interface ModelSelectorData {
  selectedIds: Array<string>
  models: Array<UnifiedModel>
  gensPerModel: number
  toggleSelected: (id: string) => void
  adjustGens: (delta: number) => void
}

interface GeneratorPanelProps {
  generator: GeneratorState
  modelSelector: ModelSelectorData
  activeModelIds: Array<string>
  toggleActiveModel: (id: string) => void
  credits: CreditsState
  userImages: UserImagesData
  error: string | null
}

export function GeneratorPanel({
  generator,
  modelSelector,
  activeModelIds,
  toggleActiveModel,
  credits,
  userImages,
  error,
}: GeneratorPanelProps) {
  return (
    <div className="bg-card rounded-lg p-6">
      <div className="space-y-3">
        {generator.sourceImage && (
          <SourceImagePreview
            src={generator.sourceImage.base64}
            name={generator.sourceImage.name}
            onRemove={generator.handleClearSourceImage}
          />
        )}

        {/* Controls row */}
        <div className="flex gap-2 items-center flex-wrap">
          {generator.inputMode === 'image' ? (
            <div className="flex-1 min-w-48">
              <ModelCheckboxList
                models={IMAGE_INPUT_MODELS}
                selected={generator.imageSelectedModels}
                onToggle={generator.toggleImageModel}
                disabled={generator.loading}
                label={`Models -- image input (${generator.imageSelectedModels.length} selected)`}
              />
            </div>
          ) : (
            <ModelSelector
              mode="multi"
              display="dropdown"
              selectedIds={modelSelector.selectedIds}
              visibleModels={modelSelector.models}
              onToggleSelected={modelSelector.toggleSelected}
              showGensPerModel
              gensPerModel={modelSelector.gensPerModel}
              onAdjustGens={modelSelector.adjustGens}
            />
          )}
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
        </div>

        {generator.inputMode !== 'image' &&
          modelSelector.selectedIds.length > 0 && (
            <ModelFilterPills
              models={modelSelector.models.filter((m) =>
                modelSelector.selectedIds.includes(m.id),
              )}
              activeIds={activeModelIds}
              onToggle={toggleActiveModel}
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

        <ActionButton
          onClick={generator.handleGenerate}
          loading={generator.loading}
          loadingText={
            generator.totalImages > 1
              ? `Generating ${generator.totalImages} images...`
              : 'Generating...'
          }
          disabled={
            !generator.canGenerate ||
            (credits.balance ?? 0) < CREDIT_COSTS.image_gen
          }
          className="w-full"
        >
          {credits.isEmpty
            ? 'Out of credits'
            : generator.totalImages > 1
              ? `Generate ${generator.totalImages} images`
              : 'Generate'}
        </ActionButton>

        {error && <ErrorBanner message={error} />}
      </div>
    </div>
  )
}
