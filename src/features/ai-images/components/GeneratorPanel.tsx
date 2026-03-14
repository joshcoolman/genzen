import { useState } from 'react'
import type { GeneratorState } from '@/features/ai-images/hooks/use-generator'
import type { CreditsState } from '@/features/credits/hooks/use-credits'
import type { ModelSlots, SlotTier } from '@/lib/model-slots'
import type { UserImage } from '@/features/user-images/types'
import { Textarea } from '@/components/ui/textarea'
import { ActionButton } from '@/components/ActionButton'
import { ImageSourceButtons } from '@/components/ImageSourceButtons'
import { SourceImagePreview } from '@/components/SourceImagePreview'
import { NumberStepper } from '@/components/NumberStepper'
import { ErrorBanner } from '@/components/ErrorBanner'
import { AspectRatioSelect } from '@/components/AspectRatioSelect'
import { RefImageStrip } from '@/components/RefImageStrip'
import { ExistingImagePicker } from '@/features/user-images/components/ExistingImagePicker'
import { getModelName } from '@/features/ai-images/models'
import { CREDIT_COSTS } from '@/features/credits'

interface UserImagesData {
  images: Array<UserImage>
  imageUrls: Record<string, string>
  isLoading: boolean
  refresh: () => Promise<void>
}

interface GeneratorPanelProps {
  generator: GeneratorState
  slots: ModelSlots
  activeTier: SlotTier
  setActiveTier: (tier: SlotTier) => void
  gensPerModel: number
  adjustGens: (delta: number) => void
  credits: CreditsState
  userImages: UserImagesData
  error: string | null
}

export function GeneratorPanel({
  generator,
  slots,
  activeTier,
  setActiveTier,
  gensPerModel,
  adjustGens,
  credits,
  userImages,
  error,
}: GeneratorPanelProps) {
  const [pickerOpen, setPickerOpen] = useState(false)

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
          <div className="flex-1" />
          <TierToggle
            activeTier={activeTier}
            onChangeTier={setActiveTier}
            slots={slots}
            disabled={generator.loading}
          />
          <NumberStepper
            value={gensPerModel}
            min={1}
            max={5}
            onAdjust={adjustGens}
            disabled={generator.loading}
          />
        </div>

        <Textarea
          id="prompt-textarea"
          placeholder={
            generator.describingImage
              ? 'Describing image...'
              : generator.sourceImage
                ? 'Edit prompt (optional)...'
                : 'Describe your image...'
          }
          value={generator.prompt}
          onChange={(e) => generator.setPrompt(e.target.value)}
          disabled={generator.loading || generator.describingImage}
          rows={generator.sourceImage ? 6 : 8}
        />

        {activeTier === 'quality' && generator.maxRefImages > 0 && (
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
              alreadyCollectedIds={
                new Set(generator.refImages.map((r) => r.id))
              }
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

function TierToggle({
  activeTier,
  onChangeTier,
  slots,
  disabled,
}: {
  activeTier: SlotTier
  onChangeTier: (tier: SlotTier) => void
  slots: ModelSlots
  disabled: boolean
}) {
  const tiers: Array<{ tier: SlotTier; label: string }> = [
    { tier: 'draft', label: 'Draft' },
    { tier: 'quality', label: 'Quality' },
  ]

  return (
    <div className="flex h-9 items-center gap-1 rounded-md border border-input px-1 shadow-xs">
      {tiers.map(({ tier, label }) => (
        <button
          key={tier}
          onClick={() => onChangeTier(tier)}
          disabled={disabled}
          title={getModelName(slots[tier])}
          className={`px-3 py-1 text-sm rounded transition-colors ${
            activeTier === tier
              ? 'bg-accent-brand/15 text-accent-brand border border-accent-brand/40 font-medium'
              : 'text-muted-foreground hover:text-foreground'
          } disabled:opacity-50`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
