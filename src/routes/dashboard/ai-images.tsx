import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  GeneratorPanel,
  ImageGallery,
  ImageLightbox,
  useAiImagesPage,
} from '@/features/ai-images'
import { VariationPromptsDialog } from '@/features/ai-images/components/VariationPromptsDialog'
import { ParentPickerDialog } from '@/features/ai-images/components/ParentPickerDialog'
import { useAiImagesADContext } from '@/features/ai-images/hooks/useAiImagesADContext'

export const Route = createFileRoute('/dashboard/ai-images')({
  component: AiImagesPage,
})

function AiImagesPage() {
  const page = useAiImagesPage()
  useAiImagesADContext(page)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            e.preventDefault()
            page.generator.setSourceFile(file)
            return
          }
        }
      }
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [page.generator])

  const [generatorOpen, setGeneratorOpen] = useState(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem('ai-images-generator-open') !== 'false'
  })

  function toggleGenerator() {
    setGeneratorOpen((prev) => {
      const next = !prev
      localStorage.setItem('ai-images-generator-open', String(next))
      return next
    })
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">AI Images</h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleGenerator}
            title={generatorOpen ? 'Hide generator' : 'Show generator'}
          >
            {generatorOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </div>
        {page.credits.balance !== null && (
          <span className="text-sm text-muted-foreground tabular-nums">
            {page.credits.balance} credits
          </span>
        )}
      </div>

      {generatorOpen && (
        <GeneratorPanel
          generator={page.generator}
          slots={page.slots}
          activeTier={page.activeTier}
          setActiveTier={page.setActiveTier}
          gensPerModel={page.gensPerModel}
          adjustGens={page.adjustGens}
          credits={page.credits}
          userImages={page.userImages}
          error={page.error}
          describe={page.describe}
        />
      )}

      <ImageGallery
        images={page.gallery.images}
        imageUrls={page.gallery.imageUrls}
        rootImageMeta={page.gallery.rootImageMeta}
        editChildrenMap={page.editChildrenMap}
        loadingGallery={page.gallery.loadingGallery}
        onOpenLightbox={page.lightbox.open}
        onLoadPrompt={page.handleLoadPrompt}
        onLoadPromptAndModel={page.handleLoadPromptAndModel}
        onDelete={page.gallery.deleteImage}
        onRestoreRoot={page.gallery.restoreRootImage}
        onRetry={page.gallery.retryImage}
        onStartAdopt={page.reparent.startAdopt}
        onDetach={(img) => void page.reparent.detach(img.id)}
      />

      <VariationPromptsDialog
        open={!!page.variations.pendingVariation}
        onOpenChange={(open) => {
          if (!open) page.variations.cancelVariationPreview()
        }}
        prompts={page.variations.pendingVariation?.prompts ?? []}
        loading={page.variations.generatingPrompts}
        submitting={page.variations.submittingVariations}
        onRun={page.variations.handleRunVariations}
        sourceImageUrl={
          page.variations.pendingVariation
            ? page.gallery.imageUrls[
                page.variations.pendingVariation.sourceImageId
              ]
            : undefined
        }
        referenceImages={[]}
        onAddReference={() => {}}
        onRemoveReference={() => {}}
      />

      {page.reparent.adoptTarget && (
        <ParentPickerDialog
          open={!!page.reparent.adoptTarget}
          onOpenChange={(open) => {
            if (!open) page.reparent.cancelAdopt()
          }}
          movingImage={page.reparent.adoptTarget}
          movingImageUrl={page.gallery.imageUrls[page.reparent.adoptTarget.id]}
          images={page.gallery.images}
          imageUrls={page.gallery.imageUrls}
          editChildrenMap={page.editChildrenMap}
          loading={page.reparent.isReparenting}
          onConfirm={(newParentId) =>
            void page.reparent.confirmAdopt(newParentId)
          }
        />
      )}

      {page.lightbox.isOpen && (
        <ImageLightbox
          images={page.completedImages}
          imageUrls={page.gallery.imageUrls}
          currentIndex={page.lightbox.index!}
          onClose={page.lightbox.close}
          onNext={page.lightbox.next}
          onPrev={page.lightbox.prev}
          onDelete={page.lightbox.deleteAndAdvance}
        />
      )}
    </div>
  )
}
