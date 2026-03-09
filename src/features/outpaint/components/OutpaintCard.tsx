import { Expand, LocateFixed } from 'lucide-react'
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
    offset,
    isGenerating,
    error,
    canOutpaint,
    existingImages,
    setOrientation,
    setAspectRatio,
    setModel,
    setOffset,
    resetOffset,
    selectImage,
    selectFile,
    outpaint,
    reset,
  } = page

  const isOffCenter = offset.x !== 0.5 || offset.y !== 0.5

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

      {/* Preview */}
      <OutpaintPreview
        sourceImageUrl={sourceImage?.url ?? null}
        sourceTitle={sourceImage?.title ?? ''}
        aspectRatio={aspectRatio}
        sourceNativeRatio={sourceNativeRatio}
        offset={offset}
        onOffsetChange={setOffset}
      />

      {isOffCenter && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={resetOffset}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <LocateFixed className="size-3.5" />
            Center
          </button>
        </div>
      )}

      {error && (
        <ErrorBanner
          message={error}
          action={{ label: 'Try Again', onClick: reset }}
        />
      )}
    </div>
  )
}
