import { useCallback, useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  GeneratorPanel,
  ImageGallery,
  ImageLightbox,
  ModelSettingsDialog,
  useAiImagesPage,
} from '@/features/ai-images'
import { useAiImagesADContext } from '@/features/ai-images/hooks/useAiImagesADContext'
import { getStyles } from '@/features/style-trainer/server/get-styles.server'
import { useAuth } from '@/lib/auth'

export const Route = createFileRoute('/dashboard/ai-images')({
  component: AiImagesPage,
})

interface StyleOption {
  id: string
  name: string
  thumbnailUrl: string | null
  image_count: number
}

function useStyleOptions() {
  const { session } = useAuth()
  const [styles, setStyles] = useState<Array<StyleOption>>([])
  const accessToken = session?.access_token

  const load = useCallback(async () => {
    if (!accessToken) return
    try {
      const result = await getStyles({ data: { accessToken } })
      setStyles(
        result.styles.map((s) => ({
          id: s.id as string,
          name: s.name as string,
          thumbnailUrl: (s.thumbnailUrl as string | null) || null,
          image_count: Number(s.image_count) || 0,
        })),
      )
    } catch {
      // styles are optional -- fail silently
    }
  }, [accessToken])

  useEffect(() => {
    load()
  }, [load])

  return styles
}

function AiImagesPage() {
  const page = useAiImagesPage()
  useAiImagesADContext(page)
  const styles = useStyleOptions()
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
          modelSettings={page.modelSettings}
          promptTools={page.promptTools}
          credits={page.credits}
          userImages={page.userImages}
          styles={styles}
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

      <ModelSettingsDialog
        open={page.modelSettings.settingsOpen}
        onOpenChange={page.modelSettings.setSettingsOpen}
        visibleModels={page.modelSettings.visibleModelIds}
        onSaveVisibleModels={page.modelSettings.setVisibleModelIds}
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
