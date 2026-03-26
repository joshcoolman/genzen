import { Trash2 } from 'lucide-react'
import type { ScenesState } from '../types'
import { Button } from '@/components/ui/button'
import { ImageSourceButtons } from '@/components/ImageSourceButtons/ImageSourceButtons'
import { SourceImagePreview } from '@/components/SourceImagePreview/SourceImagePreview'
import { DescribeImageButton } from '@/components/DescribeImageButton'
import { ModelPickerButton } from '@/components/ModelPickerButton'
import { AspectRatioSelect } from '@/components/AspectRatioSelect/AspectRatioSelect'
import { IMAGE_INPUT_MODELS } from '@/features/ai-images/models'

interface ScenesPanelProps {
  state: ScenesState
}

export function ScenesPanel({ state }: ScenesPanelProps) {
  const nonEmptyCells = state.cells.filter((c) => c.prompt.trim()).length
  const canGenerateImages = nonEmptyCells > 0 && !state.isGeneratingAll
  const hasAnyGenerations = state.cells.some((c) => c.generations.length > 0)

  return (
    <div className="flex flex-col gap-3">
      {/* Source image preview */}
      {state.sourceImage && (
        <SourceImagePreview
          src={state.sourceImage.base64}
          name={state.sourceImage.name}
          onRemove={state.clearSourceImage}
          variant="compact"
        />
      )}

      {/* Source image controls: upload, library, describe */}
      <div className="flex items-center gap-1.5">
        <ImageSourceButtons
          onFileSelected={state.setSourceFile}
          showPaste={false}
          library={{
            images: state.userImages.images,
            imageUrls: state.userImages.imageUrls,
            isLoading: state.userImages.isLoading,
            onSelect: (img) =>
              state.setSourceFromUrl(img.url, img.title, img.id),
            onOpen: state.userImages.refresh,
          }}
          className="contents"
        />

        <DescribeImageButton
          imageBase64={state.sourceImage?.base64 ?? null}
          accessToken={state.accessToken}
          onCaption={(caption) => {
            const current = state.textPrompt
            state.setTextPrompt(
              current.trim() ? `${caption}\n\n${current}` : caption,
            )
          }}
        />
      </div>

      {/* Model picker + aspect ratio */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Model
          </label>
          <ModelPickerButton
            models={IMAGE_INPUT_MODELS}
            selectedId={state.model.id}
            onSelect={(id) => {
              const m = IMAGE_INPUT_MODELS.find((model) => model.id === id)
              if (m) state.setModel(m)
            }}
          />
        </div>
        <AspectRatioSelect
          orientation={state.orientation}
          aspectRatio={state.aspectRatio}
          onOrientationChange={state.setOrientation}
          onAspectRatioChange={state.setAspectRatio}
        />
      </div>

      {/* Text prompt (shown when no source image) */}
      {!state.sourceImage && (
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Scene Description
          </label>
          <textarea
            value={state.textPrompt}
            onChange={(e) => state.setTextPrompt(e.target.value)}
            placeholder="Describe the scene you want to create..."
            rows={3}
            className="w-full resize-none rounded-md border border-border bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
          />
        </div>
      )}

      {/* Generate Prompts button (only when source image is set) */}
      {state.sourceImage && (
        <button
          onClick={() => void state.generatePrompts()}
          disabled={state.isGeneratingPrompts}
          className="w-full rounded-md bg-accent-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-brand/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {state.isGeneratingPrompts
            ? 'Generating Prompts...'
            : 'Generate Prompts'}
        </button>
      )}

      {/* Generate Images button */}
      <button
        onClick={() => void state.generateAll()}
        disabled={!canGenerateImages}
        className="w-full rounded-md border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {state.isGeneratingAll
          ? 'Generating...'
          : `Generate Images (${nonEmptyCells})`}
      </button>

      {/* Clear all */}
      {hasAnyGenerations && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-muted-foreground hover:text-destructive"
          onClick={state.clearAll}
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          Clear
        </Button>
      )}

      {/* Error */}
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
    </div>
  )
}
