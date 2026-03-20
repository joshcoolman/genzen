import { useCallback, useEffect, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Plus, Upload, X } from 'lucide-react'
import {
  GeneratorPanel,
  ImageGallery,
  ImageLightbox,
  useAiImagesPage,
} from '@/features/ai-images'
import { VariationPromptsDialog } from '@/features/ai-images/components/VariationPromptsDialog'
import { ParentPickerDialog } from '@/features/ai-images/components/ParentPickerDialog'
import { useAiImagesADContext } from '@/features/ai-images/hooks/useAiImagesADContext'
import { useImageUpload } from '@/features/user-images/hooks/useImageUpload'
import { processAndUploadFiles } from '@/features/user-images/lib/process-files'

export const Route = createFileRoute('/dashboard/ai-images')({
  component: AiImagesPage,
})

function AiImagesPage() {
  const page = useAiImagesPage()
  useAiImagesADContext(page)
  const { upload } = useImageUpload(page.userId)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUploadFiles = useCallback(
    async (files: Array<File>) => {
      await processAndUploadFiles(files, async (input) => {
        await upload(input)
      })
      await page.gallery.refresh()
    },
    [upload, page.gallery],
  )

  // Paste handler — upload directly to library
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            e.preventDefault()
            void handleUploadFiles([file])
            return
          }
        }
      }
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [handleUploadFiles])

  const [generatorOpen, setGeneratorOpen] = useState(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem('genzen:generator-panel-open') !== 'false'
  })

  useEffect(() => {
    localStorage.setItem('genzen:generator-panel-open', String(generatorOpen))
  }, [generatorOpen])

  return (
    <div className={generatorOpen ? 'mr-80' : ''}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground tabular-nums">
            AI Images
            {page.credits.balance !== null && (
              <>
                <span className="mx-2 opacity-40">|</span>
                {page.credits.balance} credits
              </>
            )}
          </span>
          <div className="flex items-center gap-1.5">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? [])
                if (files.length > 0) void handleUploadFiles(files)
                e.target.value = ''
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Upload image"
            >
              <Upload className="h-4 w-4" />
            </button>
            {!generatorOpen && (
              <button
                onClick={() => setGeneratorOpen(true)}
                className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-brand text-white hover:bg-accent-brand/90 transition-colors"
                title="New generation"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <ImageGallery
          images={page.gallery.images}
          imageUrls={page.gallery.imageUrls}
          rootImageMeta={page.gallery.rootImageMeta}
          editChildrenMap={page.editChildrenMap}
          loadingGallery={page.gallery.loadingGallery}
          onLoadPrompt={page.handleLoadPrompt}
          onLoadPromptAndModel={page.handleLoadPromptAndModel}
          onDelete={page.gallery.deleteImage}
          onRestoreRoot={page.gallery.restoreRootImage}
          onRetry={page.gallery.retryImage}
          onStartAdopt={page.reparent.startAdopt}
          onDetach={(img) => void page.reparent.detach(img.id)}
        />
      </div>

      {/* Fixed right sidebar generator panel */}
      {generatorOpen && (
        <div className="fixed top-0 right-0 h-screen w-80 border-l border-border bg-card overflow-y-auto z-30">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <span className="text-xs text-muted-foreground">Generate</span>
            <button
              onClick={() => setGeneratorOpen(false)}
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="px-4 pb-4">
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
          </div>
        </div>
      )}

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
        onGenerateMore={() => {}}
        generatingMore={false}
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
