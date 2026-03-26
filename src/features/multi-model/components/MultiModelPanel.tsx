import { Trash2 } from 'lucide-react'
import type { MultiModelState } from '../types'
import { Button } from '@/components/ui/button'
import { AspectRatioSelect } from '@/components/AspectRatioSelect/AspectRatioSelect'
import { ImageSourceButtons } from '@/components/ImageSourceButtons/ImageSourceButtons'
import { SourceImagePreview } from '@/components/SourceImagePreview/SourceImagePreview'
import { DescribeImageButton } from '@/components/DescribeImageButton'

interface MultiModelPanelProps {
  state: MultiModelState
}

export function MultiModelPanel({ state }: MultiModelPanelProps) {
  const canGenerate =
    (!!state.userPrompt.trim() ||
      !!state.systemPrompt.trim() ||
      !!state.sourceImage) &&
    state.enabledCount > 0

  const hasAnyGenerations = state.cells.some((c) => c.generations.length > 0)

  return (
    <div className="flex flex-col gap-3">
      {/* System prompt */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
          System Prompt
        </label>
        <textarea
          value={state.systemPrompt}
          onChange={(e) => state.setSystemPrompt(e.target.value)}
          placeholder="Optional style instructions..."
          rows={2}
          className="w-full resize-none rounded-md border border-border bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
        />
      </div>

      {/* User prompt */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Prompt
        </label>
        <textarea
          value={state.userPrompt}
          onChange={(e) => state.setUserPrompt(e.target.value)}
          placeholder="Describe the image..."
          rows={4}
          className="w-full resize-none rounded-md border border-border bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
        />
      </div>

      {/* Aspect ratio */}
      <AspectRatioSelect
        orientation={state.orientation}
        aspectRatio={state.aspectRatio}
        onOrientationChange={state.setOrientation}
        onAspectRatioChange={state.setAspectRatio}
      />

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
            const current = state.userPrompt
            state.setUserPrompt(
              current.trim() ? `${caption}\n\n${current}` : caption,
            )
          }}
        />
      </div>

      {/* Generate All button */}
      <button
        onClick={() => void state.generateAll()}
        disabled={!canGenerate || state.isGeneratingAll}
        className="mt-1 w-full rounded-md bg-accent-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-brand/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {state.isGeneratingAll
          ? 'Generating...'
          : `Generate (${state.enabledCount} enabled)`}
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
