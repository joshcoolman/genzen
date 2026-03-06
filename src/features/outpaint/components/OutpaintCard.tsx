import { Expand } from 'lucide-react'
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

      {/* Preview */}
      <OutpaintPreview
        sourceImageUrl={sourceImage?.url ?? null}
        sourceTitle={sourceImage?.title ?? ''}
        aspectRatio={aspectRatio}
      />

      {error && (
        <ErrorBanner
          message={error}
          action={{ label: 'Try Again', onClick: reset }}
        />
      )}
    </div>
  )
}
