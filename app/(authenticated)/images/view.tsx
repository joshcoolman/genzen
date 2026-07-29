'use client'

import { DescribeDialog } from './_components/describe-dialog/describe-dialog'
import { ImageGallery } from './_components/image-gallery/image-gallery'
import { VariationPromptsDialog } from './_components/variation-prompts-dialog/variation-prompts-dialog'
import { DownloadDialog } from './_components/download-dialog/download-dialog'
import { GeneratorDock } from './_components/generator-dock/generator-dock'
import { ImageLightbox } from './_components/image-lightbox/image-lightbox'
import { SelectionActions } from './_components/selection-actions/selection-actions'
import { Toolbar } from './_components/toolbar/toolbar'
import { Workspace } from './_components/workspace/workspace'
import { useView } from './use-view'
import type { SavedAiImage } from '#/features/ai-images/types'

export function View({ initial }: { initial: Array<SavedAiImage> }) {
  const {
    images,
    gallery,
    userImages,
    modelSelector,
    generator,
    prefs,
    dock,
    download,
    uploadFiles,
    selection,
    isBatchDeleting,
    deleteSelected,
    selectedImageId,
    toggleHighlight,
    lightbox,
    highlightFromLightbox,
    variations,
    variationSourceUrl,
    describe,
    describeTarget,
    setDescribeTarget,
    loadPrompt,
  } = useView(initial)

  return (
    <>
      <Workspace pushed={dock.open && dock.pinned}>
        <Toolbar
          prefs={prefs}
          showGenerateButton={!dock.open}
          onUpload={uploadFiles}
          onGenerate={() => dock.setOpen(true)}
        />

        <ImageGallery
          images={images}
          imageUrls={gallery.imageUrls}
          loadingGallery={gallery.loadingGallery}
          thumbSize={prefs.effectiveThumbSize}
          showInfo={prefs.showInfo}
          onLoadPrompt={loadPrompt}
          onLoadPromptAndModel={loadPrompt}
          onDelete={gallery.deleteImage}
          onRetry={gallery.retryImage}
          onDownload={download.start}
          onDescribe={setDescribeTarget}
          onGenerateVariations={variations.openVariationDialog}
          onGallery={lightbox.open}
          onOpen={toggleHighlight}
          activeId={selectedImageId ?? undefined}
          selectionActive={selection.count > 0}
          isSelected={selection.isSelected}
          onSelect={selection.toggle}
        />

        <SelectionActions
          count={selection.count}
          busy={isBatchDeleting}
          onClear={selection.clearSelection}
          onDelete={() => void deleteSelected()}
        />
      </Workspace>

      <GeneratorDock
        dock={dock}
        isMobile={prefs.isMobile}
        generator={generator}
        modelSelector={modelSelector}
        userImages={userImages}
        describe={describe}
      />

      <VariationPromptsDialog
        open={variations.variationDialogOpen}
        onOpenChange={(open) => {
          if (!open) variations.cancelVariationPreview()
        }}
        prompts={variations.variationPrompts}
        loading={variations.generatingPrompts}
        onGenerate={(guidance, count) =>
          void variations.handlePreviewVariations(guidance, count)
        }
        onApply={(prompts) =>
          variations.handleApplyVariations(
            prompts,
            generator.pastePrompts,
            variationSourceUrl,
            generator.setSourceFromUrl,
          )
        }
        sourceImageUrl={variationSourceUrl}
        referenceImages={[]}
        onAddReference={() => {}}
        onRemoveReference={() => {}}
      />

      {lightbox.isOpen && (
        <ImageLightbox
          items={lightbox.items}
          imageUrls={lightbox.imageUrls}
          currentIndex={lightbox.index!}
          onClose={lightbox.close}
          onNext={lightbox.next}
          onPrev={lightbox.prev}
          onDelete={lightbox.deleteAndAdvance}
          onEdit={highlightFromLightbox}
        />
      )}

      <DownloadDialog download={download} />

      {describeTarget && (
        <DescribeDialog
          open
          onOpenChange={(open) => {
            if (!open) setDescribeTarget(null)
          }}
          imageUrl={gallery.imageUrls[describeTarget.id]}
          imageId={describeTarget.id}
          currentDescription={describeTarget.description}
          onSave={() => void gallery.refresh()}
        />
      )}
    </>
  )
}
