'use client'

import { ImageGallery } from './_components/image-gallery/image-gallery'
import { DownloadDialog } from './_components/download-dialog/download-dialog'
import { GeneratorDock } from './_components/generator-dock/generator-dock'
import { GroupHeading } from './_components/group-heading/group-heading'
import { GroupPickerDialog } from './_components/group-picker-dialog/group-picker-dialog'
import { ImageViewer } from './_components/image-viewer/image-viewer'
import { ScopeRow } from './_components/scope-row/scope-row'
import { VisibilityStrip } from './_components/visibility-strip/visibility-strip'
import { SelectionActions } from './_components/selection-actions/selection-actions'
import { Toolbar } from './_components/toolbar/toolbar'
import { Workspace } from './_components/workspace/workspace'
import { useView } from './use-view'
import type { SavedAiImage } from '#/features/ai-images/types'
import { ConfirmDialog, NameDialog, ZipDownloadDialog } from '#/components'
import { countedBaseName } from '#/lib/download-name'

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
    referenceSheet,
    zipSelectionOpen,
    setZipSelectionOpen,
    selection,
    selectMode,
    visibility,
    hideSelected,
    focusSelected,
    isBatchDeleting,
    deleteSelected,
    viewer,
    addReference,
    usePromptText,
    loadIntoPanel,
    animate,
    groups,
    workingByGroup,
    visibleGroupMembers,
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
    moveGroup,
    dissolveGroup,
    trashGroup,
    setGroupCoverImage,
  } = useView(initial)

  const selectedImages = images.filter((img) => selection.isSelected(img.id))
  const selectedIds = selectedImages.map((img) => img.id)

  return (
    <>
      {/* Clicking away from a selection is what clears it everywhere else, and
          it was Deselect all or Escape here (#439). Passed only while
          something is picked, so an ordinary click on the background of an
          ordinary page stays an ordinary click. */}
      <Workspace
        pushed={dock.open}
        onBackgroundClick={selectMode ? selection.clearSelection : undefined}
      >
        <Toolbar
          prefs={prefs}
          panelOpen={dock.open}
          onTogglePanel={() => dock.setOpen(!dock.open)}
          groupName={activeGroup?.name}
          /* Same rule as Trash group: only inside one, where the set it
             exports is what you are looking at (#477). */
          onDownloadGroup={
            activeGroup
              ? () => setGroupFlow({ kind: 'download', group: activeGroup })
              : undefined
          }
          /* Only inside a group, which is the whole point of #431: you are
             looking at the contents when you press it. */
          onTrashGroup={
            activeGroup
              ? () =>
                  setGroupFlow({ kind: 'confirm-trash', group: activeGroup })
              : undefined
          }
          onNewGroup={() => setGroupFlow({ kind: 'create', targets: [] })}
        />

        {/* Top level only -- inside a group the group is already the scope
            (#444), and the heading takes this row's place. */}
        {activeGroup ? (
          <GroupHeading name={activeGroup.name} onBack={leaveGroup} />
        ) : (
          <ScopeRow
            value={prefs.originFilter}
            onChange={prefs.setOriginFilter}
          />
        )}

        <ImageGallery
          cells={cells}
          imageUrls={gallery.imageUrls}
          keyFor={gallery.keyFor}
          loadingGallery={gallery.loadingGallery}
          showInfo={prefs.showInfo}
          thumbZoom={prefs.thumbZoom}
          onDelete={gallery.deleteImage}
          onHide={(img) => void visibility.hide([img.id])}
          /* Only while hidden rows are on screen: that is the one state in
             which an Unhide has a card to sit on. */
          onUnhide={
            visibility.showHidden
              ? (img) => void visibility.unhide([img.id])
              : undefined
          }
          onRetry={gallery.retryImage}
          onDownload={download.start}
          onAnimate={animate}
          onOpen={viewer.open}
          onAddReference={addReference}
          onUsePrompt={usePromptText}
          onLoad={(img) => void loadIntoPanel(img)}
          workingByGroup={workingByGroup}
          expandedGroupIds={groups.expandedIds}
          /* Same rule as the swatches on a collapsed card (#504): the
             expanded strip is pictures, so a hidden one does not belong in it,
             and filtering here is what keeps it in step with Show hidden. */
          groupMembers={visibleGroupMembers}
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
          /* Shift-drag sweeps a region into the selection (#440). Additive
             only, which is why it is `addMany` and not `toggle`. */
          onSweepSelect={selection.addMany}
          onBackgroundClick={selectMode ? selection.clearSelection : undefined}
        />

        {/* Under the grid, because it explains what is missing from it and the
            eye arrives here after running out of pictures (#504). */}
        <VisibilityStrip
          hiddenCount={visibility.hiddenCount}
          showHidden={visibility.showHidden}
          onToggleHidden={visibility.setShowHidden}
          focusCount={visibility.focusIds?.size ?? null}
          onClearFocus={visibility.clearFocus}
        />

        <SelectionActions
          count={selection.count}
          busy={isBatchDeleting}
          /* One more verb in the drawer rather than a mode or a dialog
             (#476): selection already exists everywhere this makes sense. */
          sheetBusy={referenceSheet.busy}
          onCreateReferenceSheet={() => void referenceSheet.create(selectedIds)}
          onDownloadZip={() => setZipSelectionOpen(true)}
          onClear={selection.clearSelection}
          onDelete={() => void deleteSelected()}
          onHide={() => void hideSelected()}
          onFocus={focusSelected}
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

      <NameDialog
        open={groupFlow?.kind === 'create'}
        title="New group"
        confirmLabel="Create"
        onSubmit={(name) => {
          if (groupFlow?.kind !== 'create') return
          void createGroup(name, groupFlow.targets)
        }}
        onCancel={closeGroupFlow}
      />

      <NameDialog
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

      {/* The group's images as a zip (#477). `images` inside a group is the
          group's contents in the order the grid shows them, so what downloads
          is what is on screen. */}
      <ZipDownloadDialog
        open={groupFlow?.kind === 'download'}
        onOpenChange={(open) => {
          if (!open) closeGroupFlow()
        }}
        images={images}
        defaultName={groupFlow?.kind === 'download' ? groupFlow.group.name : ''}
        title="Download group"
      />

      {/* The same dialog, handed the selection instead of the group (#480).
          The name is derived here rather than on the server -- unlike the
          reference sheet, the zip never touches a route: it is built in the
          browser from the images already on screen, so the group it came from
          is `activeGroup` and nothing else knows. */}
      <ZipDownloadDialog
        open={zipSelectionOpen}
        onOpenChange={setZipSelectionOpen}
        images={selectedImages}
        defaultName={countedBaseName(
          activeGroup?.name,
          selectedImages.length,
          'selection',
        )}
        title="Download selection"
      />
    </>
  )
}
