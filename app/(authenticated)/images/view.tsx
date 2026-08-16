'use client'

import { useRef } from 'react'
import { DescribeDialog } from './_components/describe-dialog/describe-dialog'
import { ImageGallery } from './_components/image-gallery/image-gallery'
import { VariationPromptsDialog } from './_components/variation-prompts-dialog/variation-prompts-dialog'
import { DownloadDialog } from './_components/download-dialog/download-dialog'
import { GeneratorDock } from './_components/generator-dock/generator-dock'
import { GroupNameDialog } from './_components/group-name-dialog/group-name-dialog'
import { GroupPickerDialog } from './_components/group-picker-dialog/group-picker-dialog'
import { ImageViewer } from './_components/image-viewer/image-viewer'
import { SelectionActions } from './_components/selection-actions/selection-actions'
import { Toolbar } from './_components/toolbar/toolbar'
import { Workspace } from './_components/workspace/workspace'
import { useView } from './use-view'
import type { SavedAiImage } from '#/features/ai-images/types'
import { ConfirmDialog } from '#/components'

export function View({ initial }: { initial: Array<SavedAiImage> }) {
  // Where an "Upload to group" batch is headed, held across the gap between
  // choosing the group and the OS file dialog coming back. A ref, not state:
  // nothing renders from it, and a re-render between the two would be a bug
  // rather than a repaint.
  const uploadTargetRef = useRef<string | null>(null)
  const groupUploadInputRef = useRef<HTMLInputElement>(null)

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
    viewer,
    variations,
    variationSourceUrl,
    describeTarget,
    setDescribeTarget,
    addReference,
    usePromptText,
    loadIntoPanel,
    animate,
    groups,
    workingByGroup,
    activeGroup,
    activeGroupId,
    openGroup,
    leaveGroup,
    groupFlow,
    setGroupFlow,
    closeGroupFlow,
    startAddToGroup,
    startUploadToGroup,
    addToGroup,
    createGroup,
    removeFromGroup,
    renameGroup,
    moveGroup,
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
          /* Absent inside a group (the open one is the destination) and absent
             with no groups to choose from -- either way the toolbar collapses
             to a plain Upload button. */
          onUploadToGroup={
            !activeGroupId && groups.groups.length > 0
              ? startUploadToGroup
              : undefined
          }
          groupName={activeGroup?.name}
          onLeaveGroup={leaveGroup}
          onNewGroup={() => setGroupFlow({ kind: 'create', targets: [] })}
        />

        <ImageGallery
          cells={cells}
          imageUrls={gallery.imageUrls}
          keyFor={gallery.keyFor}
          loadingGallery={gallery.loadingGallery}
          showInfo={prefs.showInfo}
          onDelete={gallery.deleteImage}
          onRetry={gallery.retryImage}
          onDownload={download.start}
          onDescribe={setDescribeTarget}
          onGenerateVariations={variations.openVariationDialog}
          onAnimate={animate}
          onOpen={viewer.open}
          onAddReference={addReference}
          onUsePrompt={usePromptText}
          onLoad={(img) => void loadIntoPanel(img)}
          workingByGroup={workingByGroup}
          expandedGroupIds={groups.expandedIds}
          groupMembers={groups.members}
          onToggleGroupMembers={groups.toggleExpanded}
          onOpenGroup={openGroup}
          onRenameGroup={(group) => setGroupFlow({ kind: 'rename', group })}
          /* Only with somewhere to move to. One group is the common early
             state, and "move this into..." with nothing but itself to choose
             from is the non-choice the picker already refuses. */
          onMoveGroup={
            groups.groups.length > 1
              ? (group) => setGroupFlow({ kind: 'move', group })
              : undefined
          }
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
        selectionActive={selectMode}
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

      {viewer.isOpen && (
        <ImageViewer
          items={viewer.items}
          imageUrls={viewer.imageUrls}
          currentIndex={viewer.index!}
          onClose={viewer.close}
          onNext={viewer.next}
          onPrev={viewer.prev}
          onDelete={viewer.deleteAndAdvance}
        />
      )}

      {/* Groups (#319). One flow, four surfaces: pick a group, name a new one,
          or confirm the two that change what exists. */}
      {/* The destination for an upload that has not happened yet (#348).
          Picking is a user gesture, so clicking the file input from inside
          `onPick` opens the OS dialog -- doing it a tick later would not. */}
      <input
        ref={groupUploadInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          e.target.value = ''
          const groupId = uploadTargetRef.current
          uploadTargetRef.current = null
          if (files.length > 0 && groupId) uploadFiles(files, groupId)
        }}
      />
      <GroupPickerDialog
        open={groupFlow?.kind === 'upload-target'}
        groups={groups.groups}
        count={0}
        onPick={(groupId) => {
          closeGroupFlow()
          uploadTargetRef.current = groupId
          groupUploadInputRef.current?.click()
        }}
        onNewGroup={() => setGroupFlow({ kind: 'create', targets: [] })}
        onCancel={closeGroupFlow}
      />

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

      {/* Move to group (#350): the same picker, minus the source group and
          minus `New group...` -- moving a group's contents somewhere that does
          not exist yet is a rename, which the menu already offers. */}
      <GroupPickerDialog
        open={groupFlow?.kind === 'move'}
        groups={
          groupFlow?.kind === 'move'
            ? groups.groups.filter((g) => g.id !== groupFlow.group.id)
            : []
        }
        count={0}
        title="Move to group"
        description={
          groupFlow?.kind === 'move'
            ? `Everything in "${groupFlow.group.name}" moves, and the group goes away.`
            : ''
        }
        onPick={(groupId) => {
          if (groupFlow?.kind !== 'move') return
          void moveGroup(groupFlow.group.id, groupId)
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
