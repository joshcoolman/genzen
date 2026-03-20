import { useCallback, useState } from 'react'
import { ArrowLeft, RotateCcw, Unlink, X } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import type { useFocusedEdit } from '@/features/ai-images/hooks/use-focused-edit'
import { EDIT_MODELS } from '@/features/ai-images/models'
import { AspectRatioSelect } from '@/components/AspectRatioSelect'
import { ModelSelector } from '@/components/ModelSelector'
import { ModelFilterPills } from '@/components/ModelSelector/ModelFilterPills'
import { GenerationResultsGrid } from '@/components/GenerationResultsGrid'
import { VariationPromptsDialog } from '@/features/ai-images/components/VariationPromptsDialog'
import { ExistingImagePicker } from '@/features/user-images/components/ExistingImagePicker'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { ActionButton } from '@/components/ActionButton'
import { JsonSyntaxHighlight } from '@/components/JsonSyntaxHighlight'
import { Lightbox } from '@/components/Lightbox'
import { RefImageStrip } from '@/components/RefImageStrip'

interface FocusedEditViewProps {
  edit: ReturnType<typeof useFocusedEdit>
}

export function FocusedEditView({ edit }: FocusedEditViewProps) {
  const [imgHeight, setImgHeight] = useState<number>(0)
  const [showPrompt, setShowPrompt] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const imgRef = useCallback((el: HTMLImageElement | null) => {
    if (!el) return
    const measure = () => setImgHeight(el.offsetHeight)
    el.onload = measure
    measure()
  }, [])

  if (edit.loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-muted-foreground">Loading image...</p>
      </div>
    )
  }

  if (!edit.sourceImage) {
    return (
      <div className="space-y-4">
        <Link
          to="/dashboard/ai-images"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to AI Images
        </Link>
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border p-12 text-center">
          <h3 className="mb-2 text-lg font-semibold">Image not found</h3>
          <p className="text-sm text-muted-foreground">
            {edit.error ?? 'This image may have been deleted.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          to="/dashboard/ai-images"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to AI Images
        </Link>
        <div className="flex items-center gap-3">
          {edit.hasParent && (
            <button
              onClick={() => void edit.detachFromParent()}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <Unlink className="h-3.5 w-3.5" />
              Detach
            </button>
          )}
          {edit.credits.balance !== null && (
            <span className="text-sm text-muted-foreground tabular-nums">
              {edit.credits.balance} credits
            </span>
          )}
        </div>
      </div>

      {/* Toolbar: selectors left, generate button right */}
      <div className="flex items-center gap-2">
        <AspectRatioSelect
          orientation={edit.orientation}
          aspectRatio={edit.aspectRatio}
          onOrientationChange={edit.setOrientation}
          onAspectRatioChange={edit.setAspectRatio}
          disabled={edit.editLoading}
        />
        <ModelSelector
          mode="multi"
          display="dropdown"
          selectedIds={edit.modelSelector.selectedIds}
          visibleModels={edit.modelSelector.models}
          onToggleSelected={edit.modelSelector.toggleSelected}
          showGensPerModel
          gensPerModel={edit.modelSelector.gensPerModel}
          onAdjustGens={edit.modelSelector.adjustGens}
        />
        {edit.isChained && (
          <Button
            variant="ghost"
            size="sm"
            onClick={edit.resetToOriginal}
            className="gap-1.5 text-muted-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset to Original
          </Button>
        )}
        <div className="flex-1" />
        <Button
          variant="outline"
          onClick={edit.handleDescribeJson}
          disabled={edit.jsonLoading || edit.editLoading}
        >
          {edit.jsonLoading ? 'Describing...' : 'Describe JSON'}
        </Button>
        <Button
          variant="outline"
          onClick={edit.handleGenerateVariations}
          disabled={edit.variationPromptsLoading}
        >
          {edit.variationPromptsLoading
            ? 'Generating...'
            : 'Generate Variations'}
        </Button>
        <ActionButton
          onClick={edit.handleSubmit}
          disabled={!edit.editPrompt.trim()}
          loading={edit.editLoading}
          loadingText="Generating..."
        >
          Generate Edit
        </ActionButton>
      </div>

      <ModelFilterPills
        models={edit.modelSelector.models}
        activeIds={edit.modelSelector.selectedIds}
        onToggle={edit.modelSelector.toggleSelected}
      />

      {/* Source image + prompt textarea — textarea matches image height */}
      <div className="flex gap-4 items-start">
        <div className="shrink-0 w-[200px]">
          <div className="relative">
            <img
              ref={imgRef}
              src={edit.sourceImage.url}
              alt={edit.sourceImage.title ?? 'Source image'}
              className="w-full rounded-lg object-contain bg-black cursor-pointer"
              onClick={() => setLightboxIndex(0)}
            />
            {edit.isChained && (
              <button
                onClick={edit.resetToOriginal}
                className="absolute top-1.5 right-1.5 rounded-full bg-black/70 p-0.5 text-white hover:bg-black transition-colors cursor-pointer"
                aria-label="Reset to original"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {edit.sourceImage.prompt && (
            <div className="mt-1.5">
              <button
                onClick={() => setShowPrompt((v) => !v)}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                {showPrompt ? 'Hide prompt' : 'Show prompt'}
              </button>
              {showPrompt && (
                <p className="text-xs text-muted-foreground mt-1">
                  {edit.sourceImage.prompt}
                </p>
              )}
            </div>
          )}
        </div>
        <div className="flex-1">
          <Textarea
            placeholder="Describe the edit -- e.g. make the background a sunset, change hair color to red..."
            value={edit.editPrompt}
            onChange={(e) => edit.setEditPrompt(e.target.value)}
            disabled={edit.editLoading}
            autoFocus
            className="resize-none"
            style={imgHeight ? { height: imgHeight } : { minHeight: 200 }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                void edit.handleSubmit()
              }
            }}
          />
          <RefImageStrip
            images={edit.variationRefImages}
            max={Math.min(...EDIT_MODELS.map((m) => m.maxRefImages))}
            onAdd={() => edit.setRefPickerOpen(true)}
            onRemove={(id) => edit.handleRemoveRefImage(id)}
            disabled={edit.editLoading}
          />
        </div>
      </div>

      {edit.error && <p className="text-sm text-destructive">{edit.error}</p>}

      {/* Previous edits */}
      <GenerationResultsGrid
        results={edit.results.results}
        onDelete={edit.results.deleteResult}
        onDetach={(id) => void edit.detachResult(id)}
        onAdd={(result) => edit.promoteToSource(result)}
        onRegenerate={(result, modelId) =>
          result.prompt && edit.handleRegenerate(result.prompt, modelId)
        }
        regenerateModels={EDIT_MODELS.map((m) => ({
          id: m.id,
          name: m.name,
        }))}
        title="Previous Edits"
        prefsKey="focused-edit-results"
      />

      <VariationPromptsDialog
        open={edit.variationDialogOpen}
        onOpenChange={edit.setVariationDialogOpen}
        prompts={edit.variationPrompts}
        loading={edit.variationPromptsLoading}
        submitting={edit.variationSubmitting}
        onRun={edit.handleRunVariations}
        onGenerateMore={edit.handleGenerateMoreVariations}
        generatingMore={edit.generatingMore}
        sourceImageUrl={edit.sourceImage.url}
        referenceImages={edit.variationRefImages}
        onAddReference={() => edit.setRefPickerOpen(true)}
        onRemoveReference={edit.handleRemoveRefImage}
      />

      <ExistingImagePicker
        open={edit.refPickerOpen}
        onOpenChange={edit.setRefPickerOpen}
        images={edit.existingImages.images}
        imageUrls={edit.existingImages.imageUrls}
        isLoading={edit.existingImages.isLoading}
        alreadyCollectedIds={new Set(edit.variationRefImages.map((r) => r.id))}
        onConfirm={edit.handleAddRefImages}
        max={5}
      />

      {edit.jsonDescription && (
        <>
          <hr className="border-border" />
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              Generated JSON
            </h3>
            <JsonSyntaxHighlight json={edit.jsonDescription} />
          </div>
        </>
      )}

      {lightboxIndex !== null &&
        (() => {
          const completedResults = edit.results.results.filter(
            (r) => r.status === 'complete' && r.url,
          )
          const allImages = [
            {
              id: edit.sourceImage.id,
              url: edit.sourceImage.url,
              title: edit.sourceImage.title ?? 'Source image',
            },
            ...completedResults.map((r) => ({
              id: r.id,
              url: r.url!,
              title: r.label,
            })),
          ]
          const urls = Object.fromEntries(
            allImages.map((img) => [img.id, img.url]),
          )
          return (
            <Lightbox
              images={allImages}
              imageUrls={urls}
              currentIndex={lightboxIndex}
              onClose={() => setLightboxIndex(null)}
              onNext={() =>
                setLightboxIndex((i) =>
                  i !== null ? (i + 1) % allImages.length : i,
                )
              }
              onPrev={() =>
                setLightboxIndex((i) =>
                  i !== null
                    ? (i - 1 + allImages.length) % allImages.length
                    : i,
                )
              }
            />
          )
        })()}
    </div>
  )
}
