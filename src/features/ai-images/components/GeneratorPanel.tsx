import { useState } from 'react'
import type { GeneratorState } from '@/features/ai-images/hooks/use-generator'
import type { CreditsState } from '@/features/credits/hooks/use-credits'
import type { UserImage } from '@/features/user-images/types'
import type { useDescribeJson } from '@/features/ai-images/hooks/use-describe-json'
import type { useModelSelector } from '@/components/ModelSelector'
import { Textarea } from '@/components/ui/textarea'
import { ActionButton } from '@/components/ActionButton'
import { ImageSourceButtons } from '@/components/ImageSourceButtons'
import { SourceImagePreview } from '@/components/SourceImagePreview'
import { ErrorBanner } from '@/components/ErrorBanner'
import { NumberStepper } from '@/components/NumberStepper'
import { AspectRatioSelect } from '@/components/AspectRatioSelect'
import { RefImageStrip } from '@/components/RefImageStrip'
import { ExistingImagePicker } from '@/features/user-images/components/ExistingImagePicker'
import { ModelSelector } from '@/components/ModelSelector'
import { CREDIT_COSTS } from '@/features/credits'

interface UserImagesData {
  images: Array<UserImage>
  imageUrls: Record<string, string>
  isLoading: boolean
  refresh: () => Promise<void>
}

interface GeneratorPanelProps {
  generator: GeneratorState
  modelSelector: ReturnType<typeof useModelSelector>
  credits: CreditsState
  userImages: UserImagesData
  error: string | null
  describe?: ReturnType<typeof useDescribeJson>
  mode?: 'generate' | 'edit'
}

export function GeneratorPanel({
  generator,
  modelSelector,
  credits,
  userImages,
  error,
  describe,
  mode = 'generate',
}: GeneratorPanelProps) {
  const isEdit = mode === 'edit'
  const [pickerOpen, setPickerOpen] = useState(false)

  return (
    <div className="space-y-3">
      {/* Row 1: Source image */}
      {generator.sourceImage && (
        <SourceImagePreview
          src={generator.sourceImage.base64}
          name={generator.sourceImage.name}
          onRemove={generator.handleClearSourceImage}
          variant={isEdit ? 'square' : 'compact'}
        />
      )}

      {/* Image source buttons + aspect ratio */}
      <div className="flex gap-2 items-center">
        <ImageSourceButtons
          onFileSelected={generator.setSourceFile}
          showPaste={false}
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

      {/* Textarea */}
      <Textarea
        id="prompt-textarea"
        placeholder={
          generator.describingImage
            ? 'Describing image...'
            : isEdit
              ? 'Describe the edit...'
              : generator.sourceImage
                ? 'Edit prompt (optional)...'
                : 'Describe your image...'
        }
        value={generator.prompt}
        onChange={(e) => generator.setPrompt(e.target.value)}
        disabled={generator.loading || generator.describingImage}
        rows={4}
        className="text-xs"
      />

      {/* Ref images -- show when model supports refs */}
      {generator.maxRefImages > 0 && (
        <>
          <RefImageStrip
            images={generator.refImages}
            max={generator.maxRefImages}
            onAdd={() => {
              userImages.refresh()
              setPickerOpen(true)
            }}
            onRemove={generator.removeRefImage}
            disabled={generator.loading}
          />
          <ExistingImagePicker
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            images={userImages.images}
            imageUrls={userImages.imageUrls}
            isLoading={userImages.isLoading}
            alreadyCollectedIds={new Set(generator.refImages.map((r) => r.id))}
            onConfirm={(selected) =>
              generator.addRefImages(
                selected.map((s) => ({
                  id: s.id,
                  url: s.url,
                  title: s.title,
                })),
              )
            }
            max={generator.maxRefImages - generator.refImages.length}
          />
        </>
      )}

      {/* Generate button + gens stepper */}
      <div className="flex gap-2 items-center">
        <ActionButton
          onClick={() => {
            const cost = CREDIT_COSTS.image_gen * (generator.totalImages || 1)
            if ((credits.balance ?? 0) < cost) {
              credits.showInsufficientCredits(cost)
              return
            }
            generator.handleGenerate()
          }}
          loading={generator.loading}
          loadingText={
            generator.totalImages > 1
              ? `Generating ${generator.totalImages} images...`
              : isEdit
                ? 'Generating edit...'
                : 'Generating...'
          }
          disabled={!generator.canGenerate && !credits.isEmpty}
          className="flex-1"
        >
          {credits.isEmpty
            ? 'Out of credits'
            : isEdit
              ? generator.totalImages > 1
                ? `Generate ${generator.totalImages} edits`
                : 'Generate Edit'
              : generator.totalImages > 1
                ? `Generate ${generator.totalImages} images`
                : 'Generate'}
        </ActionButton>
        <NumberStepper
          value={modelSelector.gensPerModel}
          min={1}
          max={5}
          onAdjust={modelSelector.adjustGens}
          disabled={generator.loading}
        />
      </div>

      {/* Model selector */}
      <ModelSelector
        display="dropdown"
        mode="multi"
        selectedIds={modelSelector.selectedIds}
        visibleModels={modelSelector.models}
        onToggleSelected={modelSelector.toggleSelected}
      />

      {/* Describe / JSON -- only when source image present */}
      {generator.sourceImage && (
        <div className="flex items-center gap-2">
          <ActionButton
            variant="outline"
            onClick={() => void generator.handleCaption()}
            loading={generator.describingImage}
            loadingText="..."
            disabled={generator.loading}
            className="flex-1"
          >
            Describe
          </ActionButton>
          {describe && (
            <ActionButton
              variant="outline"
              onClick={describe.handleDescribe}
              loading={describe.jsonLoading}
              loadingText="..."
              disabled={generator.loading}
              className="flex-1"
            >
              JSON
            </ActionButton>
          )}
        </div>
      )}

      {error && <ErrorBanner message={error} />}
    </div>
  )
}
