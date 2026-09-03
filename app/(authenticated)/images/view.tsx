'use client'

import { GroupHeading } from '../_components/group-heading/group-heading'
import { GroupPickerDialog } from '../_components/group-picker-dialog/group-picker-dialog'
import { HiddenBar } from '../_components/hidden-bar/hidden-bar'
import { ImageGallery } from './_components/image-gallery/image-gallery'
import { DownloadDialog } from './_components/download-dialog/download-dialog'
import { GeneratorDock } from './_components/generator-dock/generator-dock'
import { ImageViewer } from './_components/image-viewer/image-viewer'
import { OutpaintDialog } from './_components/outpaint-dialog/outpaint-dialog'
import { OrderRow } from './_components/order-row/order-row'
import { ScopeRow } from './_components/scope-row/scope-row'
import { ShotsDialog } from './_components/shots-dialog/shots-dialog'
import { LightingDialog } from './_components/lighting-dialog/lighting-dialog'
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
    uploadFiles,
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
    outpaintTarget,
    startOutpaint,
    describeImage,
    cancelOutpaint,
    outpainting,
    runOutpaint,
    shotsOpen,
    openShots,
    closeShots,
    lightingOpen,
    openLighting,
    closeLighting,
    runLighting,
    runShots,
    groups,
    workingByGroup,
    hiddenByGroup,
    visibleGroupMembers,
    activeGroup,
    activeGroupId,
    manualOrder,
    hasManualOrder,
    reorderGroupImages,
    setGroupOrderMode,
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
          /* Undefined wherever the route is about generating rather than
             filing, which is what leaves the button out (#550). */
          onUploadFiles={uploadFiles}
          /* Same rule as Trash group: only inside one, where the set it
             exports is what you are looking at (#477). */
          onDownloadGroup={
            activeGroup
              ? () => setGroupFlow({ kind: 'download', group: activeGroup })
              : undefined
          }
          /* Still here, where you are looking at the contents when you press
             it. No longer the only way in: the group card's menu offers it
             too, guarded by the same confirm. */
          onTrashGroup={
            activeGroup
              ? () =>
                  setGroupFlow({ kind: 'confirm-trash', group: activeGroup })
              : undefined
          }
          onNewGroup={() => setGroupFlow({ kind: 'create', targets: [] })}
          manualOrder={manualOrder}
        />

        {/* Above the wall, not under it (#504): a statement about pictures
            that are missing is no use in the place you reach after running out
            of pictures. */}
        <HiddenBar
          hidden={visibility.hiddenImages}
          onShowAll={() => void visibility.showAll()}
          onUnhide={(id: string) => void visibility.unhide([id])}
          focusCount={visibility.focusIds?.size ?? null}
          onClearFocus={visibility.clearFocus}
        />

        {/* Top level only -- inside a group the group is already the scope
            (#444), and the heading takes this row's place. */}
        {activeGroup ? (
          <>
            <GroupHeading
              name={activeGroup.name}
              backLabel="Images"
              onBack={leaveGroup}
            />
            {/* Only once an arrangement exists (#505) -- dragging a card is
                what creates one, so the control arrives as the result of the
                gesture rather than as a precondition for it. It sits where
                `ScopeRow` sits at top level, which is the slot for a statement
                about what you are looking at. */}
            {(hasManualOrder || manualOrder) && (
              <OrderRow
                value={manualOrder ? 'manual' : 'date'}
                onChange={(order) => void setGroupOrderMode(order === 'manual')}
              />
            )}
          </>
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
          onRetry={gallery.retryImage}
          onDownload={download.start}
          onOutpaint={startOutpaint}
          onDescribe={describeImage}
          onOpen={viewer.open}
          onAddReference={addReference}
          onUsePrompt={usePromptText}
          onLoad={(img) => void loadIntoPanel(img)}
          workingByGroup={workingByGroup}
          hiddenByGroup={hiddenByGroup}
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
          /* The same confirm the in-group toolbar opens, on the same flow --
             it names the group and counts the pictures, so it reads correctly
             from a card that shows neither. */
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
          /* Shift-drag sweeps a region into the selection (#440). Additive
             only, which is why it is `addMany` and not `toggle`. */
          onSweepSelect={selection.addMany}
          selectedIds={selectedIds}
          /* Drag onto a group card to file it there (#438) -- the same write
             the picker dialog makes, which is why the dialog stays: it is how
             you reach a group scrolled out of view, and how you create one on
             the way. Only at top level, where group cards are in the grid. */
          onDropOnGroup={
            activeGroupId
              ? undefined
              : (groupId, ids) => void addToGroup(groupId, ids)
          }
          /* Inside a group the same press rearranges instead (#505). Exactly
             one of the two drags is ever armed -- there are no group cards to
             drop onto in here, and no arrangement to make out there. */
          onReorder={
            activeGroupId
              ? (orderedIds) => void reorderGroupImages(orderedIds)
              : undefined
          }
          onBackgroundClick={selectMode ? selection.clearSelection : undefined}
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
        uploadGroupId={activeGroupId}
        onShots={openShots}
        onLighting={openLighting}
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
          onHide={viewer.hideAndAdvance}
          onUsePrompt={usePromptText}
        />
      )}

      {/* One picture, one or more shapes (#430). Opened from a card's `...`;
          it owns nothing but its own selection, so closing it is enough to
          undo it. */}
      <OutpaintDialog
        image={outpaintTarget}
        imageUrl={
          outpaintTarget ? gallery.imageUrls[outpaintTarget.id] : undefined
        }
        busy={outpainting}
        onGenerate={(ratios) => void runOutpaint(ratios)}
        onCancel={cancelOutpaint}
      />

      {/* One camera move applied to each staged reference on its own (#553).
          Opened from the panel's Ref images header, because the strip is
          already the answer to "which pictures". */}
      <ShotsDialog
        open={shotsOpen}
        images={generator.refImages}
        onGenerate={(imageIds, shotIds, modelId, instructions) =>
          void runShots(imageIds, shotIds, modelId, instructions)
        }
        onCancel={closeShots}
      />

      {/* One light applied to each staged reference on its own (#563). Same
          way in as Shots, for the same reason: the strip already answers
          "which pictures". */}
      <LightingDialog
        open={lightingOpen}
        images={generator.refImages}
        onGenerate={(imageIds, effectIds, modelIds) =>
          void runLighting(imageIds, effectIds, modelIds)
        }
        onCancel={closeLighting}
      />

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
