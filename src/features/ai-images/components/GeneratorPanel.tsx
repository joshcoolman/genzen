import { useState } from 'react'
import { Paintbrush, Settings, X } from 'lucide-react'
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

interface StyleOption {
  id: string
  name: string
  thumbnailUrl: string | null
  image_count: number
}

interface GeneratorPanelProps {
  generator: GeneratorState
  modelSettings: ModelSettingsState
  promptTools: PromptToolsState
  credits: CreditsState
  userImages: UserImagesData
  styles: Array<StyleOption>
  error: string | null
}

export function GeneratorPanel({
  generator,
  modelSettings,
  promptTools,
  credits,
  userImages,
  styles,
  error,
}: GeneratorPanelProps) {
  const selectedStyle = styles.find((s) => s.id === generator.selectedStyleId)
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
            {styles.length > 0 && (
              <StylePicker
                styles={styles}
                selectedStyle={selectedStyle ?? null}
                onSelect={generator.setSelectedStyleId}
              />
            )}
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

function StylePicker({
  styles,
  selectedStyle,
  onSelect,
}: {
  styles: Array<StyleOption>
  selectedStyle: StyleOption | null
  onSelect: (id: string | null) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative shrink-0">
      <Button
        variant="outline"
        size="icon"
        onClick={() => setOpen(!open)}
        title={selectedStyle ? `Style: ${selectedStyle.name}` : 'Select style'}
        className={selectedStyle ? 'border-accent-brand' : ''}
      >
        {selectedStyle ? (
          selectedStyle.thumbnailUrl ? (
            <img
              src={selectedStyle.thumbnailUrl}
              alt=""
              className="size-5 rounded object-cover"
            />
          ) : (
            <Paintbrush className="size-4" />
          )
        ) : (
          <Paintbrush className="size-4" />
        )}
      </Button>

      {selectedStyle && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onSelect(null)
          }}
          className="absolute -top-1 -right-1 size-3.5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
        >
          <X className="size-2" />
        </button>
      )}

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-popover border border-border rounded-md shadow-md p-2 min-w-48 max-h-64 overflow-y-auto">
          <button
            type="button"
            onClick={() => {
              onSelect(null)
              setOpen(false)
            }}
            className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted transition-colors text-muted-foreground"
          >
            No style
          </button>
          {styles.map((style) => (
            <button
              key={style.id}
              type="button"
              onClick={() => {
                onSelect(style.id)
                setOpen(false)
              }}
              className={`w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted transition-colors flex items-center gap-2 ${
                selectedStyle?.id === style.id ? 'bg-muted' : ''
              }`}
            >
              {style.thumbnailUrl ? (
                <img
                  src={style.thumbnailUrl}
                  alt=""
                  className="size-5 rounded object-cover shrink-0"
                />
              ) : (
                <div className="size-5 rounded bg-muted shrink-0" />
              )}
              <span className="truncate">{style.name}</span>
              <span className="text-xs text-muted-foreground ml-auto shrink-0">
                {style.image_count}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
