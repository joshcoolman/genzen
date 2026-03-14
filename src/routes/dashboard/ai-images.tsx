import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  GeneratorPanel,
  ImageGallery,
  ImageLightbox,
  useAiImagesPage,
} from '@/features/ai-images'
import { useAiImagesADContext } from '@/features/ai-images/hooks/useAiImagesADContext'

export const Route = createFileRoute('/dashboard/ai-images')({
  component: AiImagesPage,
})

function AiImagesPage() {
  const page = useAiImagesPage()
  useAiImagesADContext(page)
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
          modelSelector={page.modelSelector}
          activeModelIds={page.activeModelIds}
          toggleActiveModel={page.toggleActiveModel}
          toggleAllActiveModels={page.toggleAllActiveModels}
          credits={page.credits}
          userImages={page.userImages}
          error={page.error}
        />
      )}

      <ImageGallery
        images={page.gallery.images}
        imageUrls={page.gallery.imageUrls}
        rootImageMeta={page.gallery.rootImageMeta}
        editChildrenMap={page.editChildrenMap}
        loadingGallery={page.gallery.loadingGallery}
        generatingVariationFor={page.variations.generatingVariationFor}
        onOpenLightbox={page.lightbox.open}
        onLoadPrompt={page.handleLoadPrompt}
        onLoadPromptAndModel={page.handleLoadPromptAndModel}
        onMoreLikeThis={page.variations.handleMoreLikeThis}
        onDelete={page.gallery.deleteImage}
        onRestoreRoot={page.gallery.restoreRootImage}
      />

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
