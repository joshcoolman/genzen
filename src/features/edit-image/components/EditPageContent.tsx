import { ImageIcon, Minus, Plus, X } from 'lucide-react'
import { EditModelSelector } from './EditModelSelector'
import { EditResultsGrid } from './EditResultsGrid'
import type { UseEditPageReturn } from '../hooks/useEditPage'
import { SingleImagePicker } from '@/features/describe/components/SingleImagePicker'
import { ExistingImagePicker } from '@/features/describe/components/ExistingImagePicker'
import { ActionButton } from '@/components/ActionButton'

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
    openSourcePicker,
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

      {/* Source + Ref row */}
      <div className="flex flex-wrap items-start gap-4">
        {/* Source image */}
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">Source image</p>
          <button
            onClick={openSourcePicker}
            className={`flex h-32 w-32 items-center justify-center rounded-md border transition-colors ${
              sourceImage.sourceImage
                ? 'border-accent-brand/50 p-0 overflow-hidden'
                : 'border-dashed border-border hover:border-accent-brand/50 bg-card'
            }`}
          >
            {sourceImage.sourceImage ? (
              <img
                src={sourceImage.sourceImage.url}
                alt={sourceImage.sourceImage.title}
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center gap-1 text-muted-foreground">
                <ImageIcon className="size-6" />
                <span className="text-xs">Select</span>
              </div>
            )}
          </button>
          {sourceImage.sourceImage && (
            <p className="text-[10px] text-muted-foreground">
              {sourceImage.aspectRatio}
            </p>
          )}
        </div>

        {/* Ref images */}
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
      </div>

      {/* Prompt */}
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">Edit prompt</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the edit you want to make..."
          rows={3}
          className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent-brand resize-none"
        />
      </div>

      {/* Model selector + gens per model */}
      <div className="flex flex-wrap items-start gap-6">
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-xs text-muted-foreground">Models</p>
          <EditModelSelector
            selectedModelIds={editModels.selectedModelIds}
            onToggle={editModels.toggleModel}
            maxRefImages={editModels.maxRefImages}
          />
        </div>

        <div className="shrink-0 space-y-1.5">
          <p className="text-xs text-muted-foreground">Gens per model</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => editModels.adjustGenerations(-1)}
              disabled={editModels.generationsPerModel <= 1}
              className="flex size-7 items-center justify-center rounded-md border border-border bg-card text-sm disabled:opacity-40"
            >
              <Minus className="size-3" />
            </button>
            <span className="w-6 text-center text-sm tabular-nums">
              {editModels.generationsPerModel}
            </span>
            <button
              onClick={() => editModels.adjustGenerations(1)}
              disabled={editModels.generationsPerModel >= 3}
              className="flex size-7 items-center justify-center rounded-md border border-border bg-card text-sm disabled:opacity-40"
            >
              <Plus className="size-3" />
            </button>
          </div>
        </div>
      </div>

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
      <EditResultsGrid results={results.results} />

      {/* Dialogs */}
      <SingleImagePicker
        open={sourceImage.pickerOpen}
        onOpenChange={sourceImage.setPickerOpen}
        images={existingImages.images}
        imageUrls={existingImages.imageUrls}
        isLoading={existingImages.isLoading}
        onSelect={(img) => {
          sourceImage.setSourceImage(img)
          sourceImage.setPickerOpen(false)
        }}
      />

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
