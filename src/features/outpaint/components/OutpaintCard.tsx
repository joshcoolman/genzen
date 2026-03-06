import { Check, Expand, Loader2, Plus } from 'lucide-react'
import { OUTPAINT_MODELS } from '../hooks/useOutpaintPage'
import { OutpaintPreview } from './OutpaintPreview'
import type { UseOutpaintPageReturn } from '../hooks/useOutpaintPage'
import { ImageSourceButtons } from '@/components/ImageSourceButtons'
import { AspectRatioSelect } from '@/components/AspectRatioSelect'
import { ModelSelect } from '@/components/ModelSelect'
import { ActionButton } from '@/components/ActionButton'
import { ErrorBanner } from '@/components/ErrorBanner'

interface OutpaintCardProps {
  page: UseOutpaintPageReturn
}

export function OutpaintCard({ page }: OutpaintCardProps) {
  const {
    sourceImage,
    sourceNativeRatio,
    orientation,
    aspectRatio,
    model,
    results,
    isGenerating,
    error,
    canOutpaint,
    existingImages,
    setOrientation,
    setAspectRatio,
    setModel,
    selectImage,
    selectFile,
    outpaint,
    saveResult,
    reset,
  } = page

  return (
    <div className="space-y-4">
      {/* Controls row */}
      <div className="flex items-center gap-3 flex-wrap">
        <ImageSourceButtons
          onFileSelected={selectFile}
          library={{
            images: existingImages.images,
            imageUrls: existingImages.imageUrls,
            isLoading: existingImages.isLoading,
            onSelect: selectImage,
            onOpen: existingImages.refresh,
          }}
          className="flex items-center gap-2"
        />

        <AspectRatioSelect
          orientation={orientation}
          aspectRatio={aspectRatio}
          onOrientationChange={setOrientation}
          onAspectRatioChange={setAspectRatio}
          disabled={isGenerating}
        />

        <ActionButton
          onClick={outpaint}
          disabled={!canOutpaint}
          loading={isGenerating}
          loadingText="Outpainting..."
          icon={<Expand className="size-4" />}
        >
          Outpaint
        </ActionButton>

        {!canOutpaint && sourceImage && sourceNativeRatio && (
          <p className="text-xs text-muted-foreground">
            Ratio matches source ({sourceNativeRatio})
          </p>
        )}

        <ModelSelect
          models={OUTPAINT_MODELS}
          value={model}
          onValueChange={setModel}
          disabled={isGenerating}
          className="ml-auto"
        />
      </div>

      {/* Preview + Results side by side */}
      <div className="grid grid-cols-2 gap-6 items-start">
        {/* Preview */}
        <OutpaintPreview
          sourceImageUrl={sourceImage?.url ?? null}
          sourceTitle={sourceImage?.title ?? ''}
          aspectRatio={aspectRatio}
        />

        {/* Results */}
        <div className="space-y-3">
          {results.length === 0 && !isGenerating && (
            <div
              className="rounded-lg border border-border bg-card flex items-center justify-center"
              style={{
                aspectRatio: `${aspectRatio
                  .split(':')
                  .map(Number)
                  .reduce((a, b) => a / b)}`,
              }}
            >
              <p className="text-xs text-muted-foreground">No results yet</p>
            </div>
          )}
          {isGenerating && (
            <div
              className="rounded-lg border border-border bg-card flex items-center justify-center"
              style={{
                aspectRatio: `${aspectRatio
                  .split(':')
                  .map(Number)
                  .reduce((a, b) => a / b)}`,
              }}
            >
              <div className="text-center space-y-2">
                <Loader2 className="size-5 animate-spin mx-auto text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Generating...</p>
              </div>
            </div>
          )}
          {results.map((result, index) => (
            <div
              key={`${result.url}-${index}`}
              className="relative rounded-lg border border-border bg-card overflow-hidden"
            >
              <img
                src={result.url}
                alt={`Outpaint result ${index + 1}`}
                className="w-full"
              />
              <button
                onClick={() => saveResult(index)}
                disabled={result.isSaving || result.isSaved}
                className="absolute bottom-2 right-2 flex items-center justify-center size-8 rounded-md bg-background/80 border border-border text-foreground hover:bg-background transition-colors disabled:opacity-50"
              >
                {result.isSaving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : result.isSaved ? (
                  <Check className="size-4" />
                ) : (
                  <Plus className="size-4" />
                )}
              </button>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <ErrorBanner
          message={error}
          action={{ label: 'Try Again', onClick: reset }}
        />
      )}
    </div>
  )
}
