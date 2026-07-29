'use client'

import { ArrowLeft } from 'lucide-react'
import { DescribeDialog } from '../../_components/describe-dialog/describe-dialog'
import { ExistingImagePicker } from '../../_components/existing-image-picker/existing-image-picker'
import { ImageGallery } from '../../_components/image-gallery/image-gallery'
import { VariationPromptsDialog } from '../../_components/variation-prompts-dialog/variation-prompts-dialog'
import { CircularIconButton } from './_components/circular-icon-button/circular-icon-button'
import { GeneratorDock } from './_components/generator-dock/generator-dock'
import { LoadingNote } from './_components/loading-note/loading-note'
import { SelectionActions } from './_components/selection-actions/selection-actions'
import { Toolbar } from './_components/toolbar/toolbar'
import { Workspace } from './_components/workspace/workspace'
import { useView } from './use-view'
import { EmptyState, Lightbox, Stack } from '#/components'

export function View() {
  const v = useView()
  const { page } = v

  if (page.pageLoading) return <LoadingNote>Loading image...</LoadingNote>

  if (!page.sourceImageMeta) {
    return (
      <Stack gap={16}>
        <CircularIconButton
          icon={ArrowLeft}
          to="/images"
          title="Back to Images"
        />
        <EmptyState title="Image not found">
          {page.error ?? 'This image may have been deleted.'}
        </EmptyState>
      </Stack>
    )
  }

  return (
    <Workspace docked={v.docked}>
      <Stack gap={16}>
        <Toolbar
          prefs={v.prefs}
          isMobile={v.isMobile}
          panelOpen={v.panel.open}
          onOpenPanel={() => v.panel.setOpen(true)}
          isChained={page.isChained}
          onReset={page.resetToOriginal}
          hasParent={page.hasParent}
          onDetach={() => void page.detachFromParent()}
        />

        {/* The Images gallery, scoped to this edit chain. */}
        <ImageGallery
          images={v.images}
          imageUrls={page.chainImageUrls}
          rootImageMeta={page.rootImageMeta}
          editChildrenMap={{}}
          loadingGallery={false}
          thumbSize={v.prefs.thumbSize}
          showInfo={v.prefs.showInfo}
          onDelete={v.remove}
          onRetry={page.retryImage}
          onRestoreRoot={() => {}}
          onDownload={v.downloadOne}
          onUnlink={v.unlink}
          onDescribe={v.setDescribeTarget}
          onGallery={v.openLightbox}
          onOpen={v.open}
          onChildOpen={v.openChild}
          selectionActive={v.selectionActive}
          isSelected={v.selection.isSelected}
          onSelect={(id, shiftKey) => v.selection.toggle(id, shiftKey)}
          activeId={page.activeSourceId}
          parentId={v.imageId}
        />
      </Stack>

      <GeneratorDock
        isMobile={v.isMobile}
        open={v.panel.open}
        onOpenChange={v.panel.setOpen}
        pinned={v.panel.pinned}
        onTogglePin={v.panel.togglePinned}
        adOpen={v.isADOpen}
        generator={page.generator}
        modelSelector={page.modelSelector}
        userImages={page.existingImages}
        describe={page.describe}
        mode={v.selectionActive ? 'generate' : 'edit'}
        refImagesReadOnly={v.selectionActive}
        libraryFilterIds={new Set(v.images.map((img) => img.id))}
        variationsLoading={page.variationPromptsLoading}
        onOpenVariations={page.handleOpenVariationDialog}
      />

      <SelectionActions
        count={v.selection.count}
        onClear={v.selection.clearSelection}
        onUnlink={() => void v.unlinkSelected()}
        onDownload={() => void v.downloadSelected()}
        onDelete={() => void v.deleteSelected()}
      />

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
        onAddReference={() => v.setRefPickerOpen(true)}
        onRemoveReference={(id) => page.generator.removeRefImage(id)}
      />

      <ExistingImagePicker
        open={v.refPickerOpen}
        onOpenChange={v.setRefPickerOpen}
        images={page.existingImages.images}
        imageUrls={page.existingImages.imageUrls}
        isLoading={page.existingImages.isLoading}
        alreadyCollectedIds={new Set(page.generator.refImages.map((r) => r.id))}
        onConfirm={(selected) =>
          page.generator.addRefImages(
            selected.map((s) => ({ id: s.id, url: s.url, title: s.title })),
          )
        }
        max={page.generator.maxRefImages - page.generator.refImages.length}
      />

      {v.describeTarget && (
        <DescribeDialog
          open
          onOpenChange={(open) => {
            if (!open) v.setDescribeTarget(null)
          }}
          imageUrl={page.chainImageUrls[v.describeTarget.id]}
          imageId={v.describeTarget.id}
          currentDescription={v.describeTarget.description}
        />
      )}

      {v.lightboxIndex !== null && v.lightboxImages.length > 0 && (
        <Lightbox
          images={v.lightboxImages}
          imageUrls={v.lightboxImageUrls}
          currentIndex={v.lightboxIndex}
          onClose={() => v.setLightboxIndex(null)}
          onNext={() =>
            v.setLightboxIndex((i) =>
              i === null ? 0 : (i + 1) % v.lightboxImages.length,
            )
          }
          onPrev={() =>
            v.setLightboxIndex((i) =>
              i === null
                ? 0
                : (i - 1 + v.lightboxImages.length) % v.lightboxImages.length,
            )
          }
          onDelete={v.deleteFromLightbox}
        />
      )}
    </Workspace>
  )
}
