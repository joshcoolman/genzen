import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft, Pin, PinOff, RotateCcw, Unlink } from 'lucide-react'
import type { GenerationResult } from '@/lib/types/generation-result'
import { useEditPage } from '@/features/ai-images/hooks/use-edit-page'
import { GeneratorPanel } from '@/features/ai-images/components/GeneratorPanel'
import { GenerationResultsGrid } from '@/components/GenerationResultsGrid'
import { ExistingImagePicker } from '@/features/user-images/components/ExistingImagePicker'
import { VariationPromptsDialog } from '@/features/ai-images/components/VariationPromptsDialog'
import { ActionButton } from '@/components/ActionButton'

export const Route = createFileRoute('/dashboard/edit/$imageId')({
  component: EditPage,
  validateSearch: (search: Record<string, unknown>) => ({
    sourceId: (search.sourceId as string) || undefined,
  }),
})

function EditPage() {
  const { imageId } = Route.useParams()
  const { sourceId: initialSourceId } = Route.useSearch()
  const page = useEditPage(imageId)

  const [panelPinned, setPanelPinned] = useState(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem('genzen:edit-panel-pinned') !== 'false'
  })

  useEffect(() => {
    localStorage.setItem('genzen:edit-panel-pinned', String(panelPinned))
  }, [panelPinned])

  // Ref image picker state
  const [refPickerOpen, setRefPickerOpen] = useState(false)

  // Pin the original parent image at position 0 so the grid never shifts.
  // sourceImageMeta is the selection cursor (changes on click);
  // originalImageMeta is the group identity (set once on load, never changes).
  const sourceId = page.sourceImageMeta?.id
  const allResults = useMemo(() => {
    if (!page.originalImageMeta) return page.results.results
    if (page.results.results.some((r) => r.id === page.originalImageMeta!.id))
      return page.results.results
    const parentResult: GenerationResult = {
      id: page.originalImageMeta.id,
      status: 'complete',
      url: page.originalImageMeta.url,
      label: page.originalImageMeta.title ?? 'Source',
      title: page.originalImageMeta.title ?? undefined,
    }
    return [parentResult, ...page.results.results]
  }, [page.results.results, page.originalImageMeta])

  // Click card = promote to source
  const handleSelectCard = useCallback(
    (id: string) => {
      if (id === sourceId) return
      const result = allResults.find((r) => r.id === id)
      if (result) page.selectImage(result)
    },
    [allResults, sourceId, page.selectImage],
  )

  // Pre-select child when navigating from main page thumb click
  const didApplyInitialSource = useRef(false)
  useEffect(() => {
    if (!initialSourceId || didApplyInitialSource.current || page.pageLoading)
      return
    didApplyInitialSource.current = true
    void page.selectImageById(initialSourceId)
  }, [initialSourceId, page.pageLoading, page.selectImageById])

  if (page.pageLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-muted-foreground">Loading image...</p>
      </div>
    )
  }

  if (!page.sourceImageMeta) {
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
            {page.error ?? 'This image may have been deleted.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={panelPinned ? 'mr-80' : ''}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link
            to="/dashboard/ai-images"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to AI Images
          </Link>
          <div className="flex items-center gap-3">
            {page.isChained && (
              <button
                onClick={page.resetToOriginal}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </button>
            )}
            {page.hasParent && (
              <button
                onClick={() => void page.detachFromParent()}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <Unlink className="h-3.5 w-3.5" />
                Detach
              </button>
            )}
            {page.credits.balance !== null && (
              <span className="text-sm text-muted-foreground tabular-nums">
                {page.credits.balance} credits
              </span>
            )}
          </div>
        </div>

        {/* Results grid */}
        <GenerationResultsGrid
          results={allResults}
          selectedId={sourceId}
          selectedClassName="border-emerald-500 ring-1 ring-emerald-500"
          onSelect={handleSelectCard}
          onDelete={(id) => {
            if (id === sourceId) return
            void page.results.deleteResult(id)
          }}
          onDetach={(id) => void page.detachResult(id)}
          editMode
          title="Edits"
          prefsKey="edit-page-results"
        />
      </div>

      {/* Right sidebar */}
      <div
        className={
          panelPinned
            ? 'fixed top-0 right-0 h-screen w-80 border-l border-border bg-black/90 backdrop-blur-2xl overflow-y-auto z-30'
            : 'fixed top-0 right-0 h-screen w-80 border-l border-border bg-black/90 backdrop-blur-2xl overflow-y-auto z-30 shadow-xl'
        }
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <span className="text-xs text-muted-foreground">Edit</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPanelPinned((p) => !p)}
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors"
              title={panelPinned ? 'Unpin (overlay)' : 'Pin (inline)'}
            >
              {panelPinned ? (
                <Pin className="h-3.5 w-3.5" />
              ) : (
                <PinOff className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
        <div className="px-4 pb-4 space-y-3">
          <GeneratorPanel
            generator={page.generator}
            modelSelector={page.modelSelector}
            credits={page.credits}
            userImages={page.existingImages}
            error={page.error}
            describe={page.describe}
            mode="edit"
          />

          {/* Variations button */}
          <ActionButton
            variant="outline"
            onClick={page.handleOpenVariationDialog}
            loading={page.variationPromptsLoading}
            loadingText="Generating..."
            className="w-full"
          >
            Generate Variations
          </ActionButton>
        </div>
      </div>

      {/* Variation prompts dialog */}
      <VariationPromptsDialog
        open={page.variationDialogOpen}
        onOpenChange={page.setVariationDialogOpen}
        prompts={page.variationPrompts}
        loading={page.variationPromptsLoading}
        onGenerate={(guidance, count) =>
          void page.handleGenerateVariations(guidance, count)
        }
        onApply={(prompts) => {
          page.generator.pastePrompts(prompts)
          page.setVariationDialogOpen(false)
        }}
        sourceImageUrl={page.sourceImageMeta.url}
        referenceImages={page.generator.refImages}
        onAddReference={() => setRefPickerOpen(true)}
        onRemoveReference={(id) => page.generator.removeRefImage(id)}
      />

      {/* Ref image picker */}
      <ExistingImagePicker
        open={refPickerOpen}
        onOpenChange={setRefPickerOpen}
        images={page.existingImages.images}
        imageUrls={page.existingImages.imageUrls}
        isLoading={page.existingImages.isLoading}
        alreadyCollectedIds={new Set(page.generator.refImages.map((r) => r.id))}
        onConfirm={(selected) =>
          page.generator.addRefImages(
            selected.map((s) => ({
              id: s.id,
              url: s.url,
              title: s.title,
            })),
          )
        }
        max={page.generator.maxRefImages - page.generator.refImages.length}
      />
    </div>
  )
}
