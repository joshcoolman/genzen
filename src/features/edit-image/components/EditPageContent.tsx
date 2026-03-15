import { Plus, X } from 'lucide-react'
import type { UseEditPageReturn } from '../hooks/useEditPage'
import { ModelSelector } from '@/components/ModelSelector'
import { GenerationResultsGrid } from '@/components/GenerationResultsGrid'
import { ExistingImagePicker } from '@/features/user-images/components/ExistingImagePicker'
import { ActionButton } from '@/components/ActionButton'
import { ImageSourceButtons } from '@/components/ImageSourceButtons'
import { SourceImagePreview } from '@/components/SourceImagePreview'

interface EditPageContentProps {
  page: UseEditPageReturn
}

export function EditPageContent({ page }: EditPageContentProps) {
  const {
    sourceImage,
    editModels,
    results,
    existingImages,
    prompt,
    setPrompt,
    refImages,
    refPickerOpen,
    setRefPickerOpen,
    handleSourceFile,
    openRefPicker,
    removeRefImage,
    handleRefImagesConfirm,
    handleGenerate,
  } = page

  const canGenerate =
    !!sourceImage.sourceImage && !!prompt.trim() && !results.isSubmitting

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Edit Image</h1>

      {/* Toolbar row: image source + model selector */}
      <div className="flex items-start gap-4">
        <ImageSourceButtons
          onFileSelected={handleSourceFile}
          library={{
            images: existingImages.images,
            imageUrls: existingImages.imageUrls,
            isLoading: existingImages.isLoading,
            onSelect: (img) => sourceImage.setSourceFromLibrary(img),
            onOpen: () => existingImages.refresh(),
          }}
          className="flex items-center gap-1"
        />
        <div className="flex-1">
          <ModelSelector
            mode="multi"
            display="inline"
            defaultExpanded
            selectedIds={editModels.selectedModelIds}
            visibleModels={editModels.models}
            onToggleSelected={editModels.toggleModel}
            showGensPerModel
            gensPerModel={editModels.generationsPerModel}
            onAdjustGens={editModels.adjustGenerations}
          />
        </div>
      </div>

      {/* Source image preview */}
      {sourceImage.sourceImage && (
        <SourceImagePreview
          src={sourceImage.sourceImage.url}
          name={sourceImage.sourceImage.title}
          onRemove={sourceImage.clearSourceImage}
        />
      )}
      {sourceImage.isUploading && (
        <p className="text-xs text-muted-foreground">Uploading...</p>
      )}
      {sourceImage.uploadError && (
        <p className="text-xs text-destructive">{sourceImage.uploadError}</p>
      )}

      {/* Prompt */}
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">Edit prompt</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the edit you want to make..."
          className="h-44 w-full rounded-md border border-border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent-brand resize-none"
        />
      </div>

      {/* Reference images */}
      {editModels.maxRefImages > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">
            Reference images ({refImages.length}/{editModels.maxRefImages})
          </p>
          <div className="flex flex-wrap gap-2">
            {refImages.map((img) => (
              <div key={img.id} className="group relative h-16 w-16">
                <img
                  src={img.url}
                  alt={img.title}
                  className="h-full w-full rounded-md border border-border object-contain bg-card"
                />
                <button
                  onClick={() => removeRefImage(img.id)}
                  className="absolute -right-1 -top-1 hidden rounded-full bg-background border border-border p-0.5 group-hover:flex"
                  aria-label="Remove"
                >
                  <X className="size-2.5" />
                </button>
              </div>
            ))}
            {refImages.length < editModels.maxRefImages && (
              <button
                onClick={openRefPicker}
                className="flex h-16 w-16 items-center justify-center rounded-md border border-dashed border-border bg-card text-muted-foreground transition-colors hover:border-accent-brand/50"
              >
                <Plus className="size-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Generate button */}
      <div className="space-y-2">
        {results.error && (
          <p className="text-xs text-destructive">{results.error}</p>
        )}
        <ActionButton onClick={handleGenerate} disabled={!canGenerate}>
          {results.isSubmitting ? 'Generating...' : 'Generate'}
        </ActionButton>
      </div>

      {/* Results */}
      <GenerationResultsGrid
        results={results.results}
        onDelete={results.deleteResult}
      />

      {/* Ref image picker dialog */}
      <ExistingImagePicker
        open={refPickerOpen}
        onOpenChange={setRefPickerOpen}
        images={existingImages.images}
        imageUrls={existingImages.imageUrls}
        isLoading={existingImages.isLoading}
        alreadyCollectedIds={new Set(refImages.map((img) => img.id))}
        excludeIds={
          sourceImage.sourceImage
            ? new Set([sourceImage.sourceImage.id])
            : undefined
        }
        max={editModels.maxRefImages}
        onConfirm={handleRefImagesConfirm}
      />
    </div>
  )
}
