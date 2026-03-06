import { BookOpen, Layers, X } from 'lucide-react'
import { COMBINE_MODELS } from '../hooks/useCombinePage'
import type { UseCombinePageReturn } from '../hooks/useCombinePage'
import { ImageSourceButtons } from '@/components/ImageSourceButtons'
import { ExistingImagePicker } from '@/features/describe/components/ExistingImagePicker'
import { AspectRatioSelect } from '@/components/AspectRatioSelect'
import { ModelSelect } from '@/components/ModelSelect'
import { ActionButton } from '@/components/ActionButton'
import { ErrorBanner } from '@/components/ErrorBanner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface CombineCardProps {
  page: UseCombinePageReturn
}

export function CombineCard({ page }: CombineCardProps) {
  const {
    sourceImages,
    prompt,
    orientation,
    aspectRatio,
    model,
    isGenerating,
    error,
    canCombine,
    existingImages,
    libraryPickerOpen,
    setLibraryPickerOpen,
    openLibraryPicker,
    handleLibraryConfirm,
    setPrompt,
    setOrientation,
    setAspectRatio,
    setModel,
    addFile,
    removeImage,
    combine,
  } = page

  return (
    <div className="space-y-4">
      {/* Controls row */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={openLibraryPicker}
            className="shrink-0"
          >
            <BookOpen />
          </Button>
          <ImageSourceButtons
            onFileSelected={addFile}
            multiple
            className="flex items-center gap-2"
          />
        </div>

        <AspectRatioSelect
          orientation={orientation}
          aspectRatio={aspectRatio}
          onOrientationChange={setOrientation}
          onAspectRatioChange={setAspectRatio}
          disabled={isGenerating}
        />

        <ActionButton
          onClick={combine}
          disabled={!canCombine}
          loading={isGenerating}
          loadingText="Combining..."
          icon={<Layers className="size-4" />}
        >
          Combine
        </ActionButton>

        {sourceImages.length > 0 && sourceImages.length < 2 && (
          <p className="text-xs text-muted-foreground">
            Select at least 2 images
          </p>
        )}

        <ModelSelect
          models={COMBINE_MODELS}
          value={model}
          onValueChange={setModel}
          disabled={isGenerating}
          className="ml-auto"
        />
      </div>

      {/* Source images + prompt */}
      <div className="space-y-3">
        {sourceImages.length === 0 ? (
          <div className="rounded-lg border border-border bg-card flex items-center justify-center py-12">
            <p className="text-xs text-muted-foreground">
              Select images to combine
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-6 gap-2">
            {sourceImages.map((img) => (
              <div
                key={img.id}
                className="relative rounded-lg border border-border bg-card overflow-hidden group"
              >
                <img
                  src={img.url}
                  alt={img.title}
                  className="w-full aspect-square object-cover"
                />
                <button
                  onClick={() => removeImage(img.id)}
                  className="absolute top-1 right-1 flex items-center justify-center size-5 rounded-full bg-background/80 border border-border text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe how to combine these images..."
          rows={3}
          className="resize-none text-sm"
        />
      </div>

      {error && <ErrorBanner message={error} />}

      <ExistingImagePicker
        open={libraryPickerOpen}
        onOpenChange={setLibraryPickerOpen}
        images={existingImages.images}
        imageUrls={existingImages.imageUrls}
        isLoading={existingImages.isLoading}
        alreadyCollectedIds={new Set(sourceImages.map((img) => img.id))}
        onConfirm={handleLibraryConfirm}
      />
    </div>
  )
}
