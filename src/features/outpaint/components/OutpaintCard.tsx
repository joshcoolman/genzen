import { Check, Expand, Loader2, Plus } from 'lucide-react'
import { OUTPAINT_MODELS } from '../hooks/useOutpaintPage'
import { OutpaintPreview } from './OutpaintPreview'
import type { UseOutpaintPageReturn } from '../hooks/useOutpaintPage'
import { ImageSourceButtons } from '@/components/ImageSourceButtons'
import { AspectRatioSelect } from '@/components/AspectRatioSelect'
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
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Model</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={isGenerating}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
          >
            {OUTPAINT_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <AspectRatioSelect
          orientation={orientation}
          aspectRatio={aspectRatio}
          onOrientationChange={setOrientation}
          onAspectRatioChange={setAspectRatio}
          disabled={isGenerating}
        />

        {sourceNativeRatio && (
          <span className="text-xs text-muted-foreground">
            Source: {sourceNativeRatio}
          </span>
        )}
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-2 gap-6">
        {/* Left: Source + Preview */}
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Source</p>
          <div className="aspect-square rounded-lg border border-border bg-card overflow-hidden flex items-center justify-center">
            {sourceImage ? (
              <img
                src={sourceImage.url}
                alt={sourceImage.title}
                className="h-full w-full object-contain bg-black"
              />
            ) : (
              <p className="text-xs text-muted-foreground">
                Select an image below
              </p>
            )}
          </div>
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

          {sourceImage && canOutpaint && (
            <>
              <p className="text-xs text-muted-foreground">Preview</p>
              <OutpaintPreview
                sourceImageUrl={sourceImage.url}
                sourceTitle={sourceImage.title}
                aspectRatio={aspectRatio}
              />
            </>
          )}

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
              Select a different aspect ratio than the source (
              {sourceNativeRatio})
            </p>
          )}
        </div>

        {/* Right: Results */}
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Results ({results.length})
          </p>
          {results.length === 0 && !isGenerating && (
            <div className="aspect-square rounded-lg border border-border bg-card flex items-center justify-center">
              <p className="text-xs text-muted-foreground">No results yet</p>
            </div>
          )}
          {isGenerating && (
            <div className="aspect-video rounded-lg border border-border bg-card flex items-center justify-center">
              <div className="text-center space-y-2">
                <Loader2 className="size-5 animate-spin mx-auto text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Generating...</p>
              </div>
            </div>
          )}
          <div className="space-y-3">
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
