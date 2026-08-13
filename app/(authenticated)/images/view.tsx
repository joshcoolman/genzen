'use client'

import { DescribeDialog } from './_components/describe-dialog/describe-dialog'
import { ImageGallery } from './_components/image-gallery/image-gallery'
import { VariationPromptsDialog } from './_components/variation-prompts-dialog/variation-prompts-dialog'
import { DownloadDialog } from './_components/download-dialog/download-dialog'
import { GeneratorDock } from './_components/generator-dock/generator-dock'
import { GroupNameDialog } from './_components/group-name-dialog/group-name-dialog'
import { GroupPickerDialog } from './_components/group-picker-dialog/group-picker-dialog'
import { ImageLightbox } from './_components/image-lightbox/image-lightbox'
import { Experiment } from './_components/experiment/experiment'
import { SelectionActions } from './_components/selection-actions/selection-actions'
import { Toolbar } from './_components/toolbar/toolbar'
import { Workspace } from './_components/workspace/workspace'
import { ORIGIN_FILTER_LABELS } from './_hooks/use-prefs'
import { useView } from './use-view'
import type { SavedAiImage } from '#/features/ai-images/types'
import { ConfirmDialog } from '#/components'

export function View({ initial }: { initial: Array<SavedAiImage> }) {
  const {
    images,
    cells,
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
    isBatchDeleting,
    deleteSelected,
    lightbox,
    experiment,
    variations,
    variationSourceUrl,
    describeTarget,
    setDescribeTarget,
    addReference,
    usePromptText,
    animate,
    groups,
    activeGroup,
    activeGroupId,
    openGroup,
    leaveGroup,
    groupFlow,
    setGroupFlow,
    closeGroupFlow,
    startAddToGroup,
    addToGroup,
    createGroup,
    removeFromGroup,
    renameGroup,
    dissolveGroup,
    trashGroup,
    setGroupCoverImage,
  } = useView(initial)

  const selectedIds = images
    .filter((img) => selection.isSelected(img.id))
    .map((img) => img.id)

  return (
    <>
      <Workspace pushed={dock.open}>
        <Toolbar
          prefs={prefs}
          panelOpen={dock.open}
          onTogglePanel={() => dock.setOpen(!dock.open)}
          onUpload={uploadFiles}
          groupName={activeGroup?.name}
          onLeaveGroup={leaveGroup}
          onNewGroup={() => setGroupFlow({ kind: 'create', targets: [] })}
        />

        {/* Before the gallery, not after: its anchor is measured to find the
            top of the grid area. */}
        {experiment.isOpen && (
          <Experiment
            items={experiment.items}
            imageUrls={experiment.imageUrls}
            currentIndex={experiment.index!}
            onClose={experiment.close}
            onNext={experiment.next}
            onPrev={experiment.prev}
          />
        )}

        <ImageGallery
          cells={cells}
          imageUrls={gallery.imageUrls}
          loadingGallery={gallery.loadingGallery}
          showInfo={prefs.showInfo}
          onDelete={gallery.deleteImage}
          onRetry={gallery.retryImage}
          onDownload={download.start}
          onDescribe={setDescribeTarget}
          onGenerateVariations={variations.openVariationDialog}
          onAnimate={animate}
          onOpen={lightbox.open}
          onExperiment={experiment.open}
          onAddReference={addReference}
          onUsePrompt={usePromptText}
          onOpenGroup={openGroup}
          onRenameGroup={(group) => setGroupFlow({ kind: 'rename', group })}
          onDissolveGroup={(group) =>
            setGroupFlow({ kind: 'confirm-dissolve', group })
          }
          onTrashGroup={(group) =>
            setGroupFlow({ kind: 'confirm-trash', group })
          }
          onAddToGroup={(img) => startAddToGroup([img.id])}
          onRemoveFromGroup={
            activeGroupId ? (img) => void removeFromGroup([img.id]) : undefined
          }
          onSetGroupCover={
            activeGroupId ? (img) => void setGroupCoverImage(img) : undefined
          }
          emptyScopeLabel={
            activeGroupId || prefs.originFilter === 'all'
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
          onAddToGroup={() => startAddToGroup(selectedIds)}
          onRemoveFromGroup={
            activeGroupId ? () => void removeFromGroup(selectedIds) : undefined
          }
        />
      </Workspace>

      <GeneratorDock
        dock={dock}
        isMobile={prefs.isMobile}
        generator={generator}
        modelSelector={modelSelector}
        userImages={userImages}
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
            generator.appendPrompts,
            variationSourceUrl,
            generator.setPrimaryImage,
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

      {/* Groups (#319). One flow, four surfaces: pick a group, name a new one,
          or confirm the two that change what exists. */}
      <GroupPickerDialog
        open={groupFlow?.kind === 'pick'}
        groups={groups.groups}
        count={groupFlow?.kind === 'pick' ? groupFlow.targets.length : 0}
        onPick={(groupId) => {
          if (groupFlow?.kind !== 'pick') return
          void addToGroup(groupId, groupFlow.targets)
        }}
        onNewGroup={() => {
          if (groupFlow?.kind !== 'pick') return
          setGroupFlow({ kind: 'create', targets: groupFlow.targets })
        }}
        onCancel={closeGroupFlow}
      />

      <GroupNameDialog
        open={groupFlow?.kind === 'create'}
        title="New group"
        confirmLabel="Create"
        onSubmit={(name) => {
          if (groupFlow?.kind !== 'create') return
          void createGroup(name, groupFlow.targets)
        }}
        onCancel={closeGroupFlow}
      />

      <GroupNameDialog
        open={groupFlow?.kind === 'rename'}
        title="Rename group"
        initialName={groupFlow?.kind === 'rename' ? groupFlow.group.name : ''}
        confirmLabel="Rename"
        onSubmit={(name) => {
          if (groupFlow?.kind !== 'rename') return
          void renameGroup(groupFlow.group.id, name)
        }}
        onCancel={closeGroupFlow}
      />

      <ConfirmDialog
        open={groupFlow?.kind === 'confirm-dissolve'}
        title="Ungroup these images?"
        message={
          groupFlow?.kind === 'confirm-dissolve'
            ? `All ${groupFlow.group.count} image${groupFlow.group.count === 1 ? '' : 's'} go back to the top level. Only the group "${groupFlow.group.name}" goes away.`
            : ''
        }
        confirmLabel="Ungroup"
        destructive={false}
        onConfirm={() => {
          if (groupFlow?.kind !== 'confirm-dissolve') return
          void dissolveGroup(groupFlow.group.id)
        }}
        onCancel={closeGroupFlow}
      />

      <ConfirmDialog
        open={groupFlow?.kind === 'confirm-trash'}
        title="Trash this group?"
        message={
          groupFlow?.kind === 'confirm-trash'
            ? groupFlow.group.count === 0
              ? `"${groupFlow.group.name}" is empty, so this just removes the group.`
              : `"${groupFlow.group.name}" and its ${groupFlow.group.count} image${groupFlow.group.count === 1 ? '' : 's'} go to Trash. You can restore the images from there.`
            : ''
        }
        confirmLabel="Trash group"
        onConfirm={() => {
          if (groupFlow?.kind !== 'confirm-trash') return
          void trashGroup(groupFlow.group.id)
        }}
        onCancel={closeGroupFlow}
      />

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
