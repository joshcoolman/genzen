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
import { ORIGIN_FILTER_LABELS } from './_hooks/use-prefs'
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
    selectMode,
    toggleSelectMode,
    isBatchDeleting,
    deleteSelected,
    lightbox,
    variations,
    variationSourceUrl,
    describe,
    describeTarget,
    setDescribeTarget,
    focusSource,
    usePromptText,
  } = useView(initial)

  return (
    <>
      <Workspace pushed={dock.open && dock.pinned}>
        <Toolbar
          prefs={prefs}
          showGenerateButton={!dock.open}
          panelFloating={dock.open && !dock.pinned && !prefs.isMobile}
          selectMode={selectMode}
          onToggleSelectMode={toggleSelectMode}
          onUpload={uploadFiles}
          onGenerate={() => dock.setOpen(true)}
        />

        <ImageGallery
          images={images}
          imageUrls={gallery.imageUrls}
          loadingGallery={gallery.loadingGallery}
          showInfo={prefs.showInfo}
          onDelete={gallery.deleteImage}
          onRetry={gallery.retryImage}
          onDownload={download.start}
          onDescribe={setDescribeTarget}
          onGenerateVariations={variations.openVariationDialog}
          onOpen={lightbox.open}
          onFocusSource={focusSource}
          onUsePrompt={usePromptText}
          emptyScopeLabel={
            prefs.originFilter === 'all'
              ? undefined
              : ORIGIN_FILTER_LABELS[prefs.originFilter]
          }
          selectionActive={selectMode}
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
          thumbnailUrls={lightbox.thumbnailUrls}
          currentIndex={lightbox.index!}
          onClose={lightbox.close}
          onSelect={lightbox.select}
          onNext={lightbox.next}
          onPrev={lightbox.prev}
          onDelete={lightbox.deleteAndAdvance}
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
