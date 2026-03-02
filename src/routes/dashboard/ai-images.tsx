import { createFileRoute } from '@tanstack/react-router'
import {
  BrainstormPanel,
  EditImageDialog,
  GeneratorPanel,
  ImageGallery,
  ImageLightbox,
  ModelSettingsDialog,
  getModelName,
  useAiImagesPage,
} from '@/features/ai-images'

export const Route = createFileRoute('/dashboard/ai-images')({
  component: AiImagesPage,
})

function AiImagesPage() {
  const page = useAiImagesPage()

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">AI Images</h1>
        {page.credits.balance !== null && (
          <span className="text-sm text-muted-foreground tabular-nums">
            {page.credits.balance} credits
          </span>
        )}
      </div>

      <BrainstormPanel
        accessToken={page.accessToken}
        refineModels={page.modelSettings.selectedModels}
        aspectRatio={page.generator.aspectRatio}
      />

      <GeneratorPanel
        generator={page.generator}
        modelSettings={page.modelSettings}
        promptTools={page.promptTools}
        credits={page.credits}
        error={page.error}
      />

      <ImageGallery
        images={page.gallery.images}
        imageUrls={page.gallery.imageUrls}
        loadingGallery={page.gallery.loadingGallery}
        generatingVariationFor={page.variations.generatingVariationFor}
        onReorder={(id, order) => void page.gallery.reorderImages(id, order)}
        onOpenLightbox={page.lightbox.open}
        onLoadPrompt={page.handleLoadPrompt}
        onLoadPromptAndModel={page.handleLoadPromptAndModel}
        onMoreLikeThis={page.variations.handleMoreLikeThis}
        onEdit={page.editor.openEditor}
        onDelete={page.gallery.deleteImage}
      />

      <ModelSettingsDialog
        open={page.modelSettings.settingsOpen}
        onOpenChange={page.modelSettings.setSettingsOpen}
        visibleModels={page.modelSettings.visibleModelIds}
        onSaveVisibleModels={page.modelSettings.setVisibleModelIds}
      />

      <EditImageDialog
        editor={page.editor}
        imageUrls={page.gallery.imageUrls}
        selectableImages={page.completedImages}
      />

      {page.lightbox.isOpen && (
        <ImageLightbox
          images={page.completedImages}
          imageUrls={page.gallery.imageUrls}
          currentIndex={page.lightbox.index!}
          onClose={page.lightbox.close}
          onNext={page.lightbox.next}
          onPrev={page.lightbox.prev}
          getModelName={getModelName}
        />
      )}
    </div>
  )
}
