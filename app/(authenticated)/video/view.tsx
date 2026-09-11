'use client'

import { ExistingImagePicker } from '../_components/existing-image-picker/existing-image-picker'
import { GroupHeading } from '../_components/group-heading/group-heading'
import { GroupPickerDialog } from '../_components/group-picker-dialog/group-picker-dialog'
import { HiddenBar } from '../_components/hidden-bar/hidden-bar'
import { useSelectionPanelFits } from '../_components/selection-panel/selection-panel'
import { ImageInputs } from './_components/image-inputs/image-inputs'
import { ModelPicker } from './_components/model-picker/model-picker'
import { SelectionActions } from './_components/selection-actions/selection-actions'
import { VideoForm } from './_components/video-form/video-form'
import { VideoPlayerDialog } from './_components/video-player-dialog/video-player-dialog'
import { VideoList } from './_components/video-list/video-list'
import { useView } from './use-view'
import styles from './video.module.css'
import type { VideoRecord } from './_actions/generate-video.action'
import { MAX_VIDEO_IMAGES } from '#/features/video/inputs'
import { ConfirmDialog, NameDialog, PageHeader, Stack } from '#/components'

export function View({ initialVideos }: { initialVideos: Array<VideoRecord> }) {
  const {
    pickerModels,
    modelSlug,
    selectModel,
    durationOptions,
    endpoint,
    compatibilityError,
    aspectOptions,
    resolutionOptions,
    userImages,
    sources,
    pickerOpen,
    setPickerOpen,
    openPicker,
    collectSources,
    clearSources,
    removeSource,
    setImageRole,
    cells,
    visibility,
    hideSelected,
    groups,
    expandedGroupIds,
    groupMembers,
    toggleGroupMembers,
    workingByGroup,
    hiddenByGroup,
    activeGroup,
    activeGroupId,
    groupFlow,
    setGroupFlow,
    closeGroupFlow,
    startAddToGroup,
    addToGroup,
    createGroup,
    removeFromGroup,
    openGroup,
    leaveGroup,
    renameGroup,
    dissolveGroup,
    trashGroup,
    selectedIds,
    toggleSelected,
    clearSelection,
    selectedCount,
    isBatchDeleting,
    deleteSelected,
    playingVideo,
    setPlayingId,
    deleteVideo,
    continueFrom,
    isContinuing,
    prompts,
    updatePrompt,
    addPrompt,
    removePrompt,
    clearPrompts,
    pendingCount,
    duration,
    setDuration,
    aspectRatio,
    setAspectRatio,
    resolution,
    setResolution,
    estimatedCost,
    needsConfirm,
    promptCount,
    isSubmitting,
    canSubmit,
    submit,
  } = useView(initialVideos)

  const panelFits = useSelectionPanelFits()
  /* One list of verbs, two places it can appear: the controls column on a wide
     screen (#587), and the bottom drawer once that column has stacked under
     the wall, where a takeover would put the verbs off the bottom of a long
     page. */
  const selectionSurface = selectedCount > 0 && panelFits ? 'panel' : 'drawer'
  const selectionActions = (
    <SelectionActions
      surface={selectionSurface}
      count={selectedCount}
      busy={isBatchDeleting}
      hideBusy={visibility.busy}
      onClear={clearSelection}
      onAddToGroup={startAddToGroup}
      onRemoveFromGroup={
        activeGroupId ? () => void removeFromGroup() : undefined
      }
      onHide={() => void hideSelected()}
      onDelete={() => void deleteSelected()}
    />
  )

  return (
    <Stack gap={24}>
      <VideoPlayerDialog
        video={playingVideo}
        onClose={() => setPlayingId(null)}
      />
      {/* The group's name **replaces** the route's header rather than sitting
          under it (#517), which is what Images does and for the same reason:
          two titles is two `h1`s, and the second one is the answer to "where
          am I" that the first one no longer gives. Leaving a group puts the
          route header back. */}
      {activeGroup ? (
        <GroupHeading
          name={activeGroup.name}
          backLabel="Video"
          onBack={leaveGroup}
        />
      ) : (
        <PageHeader
          title="Video"
          description="An image you already made, plus a note, comes back moving."
        />
      )}

      <ExistingImagePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        images={userImages.images}
        imageUrls={userImages.imageUrls}
        isLoading={userImages.isLoading}
        alreadyCollectedIds={new Set(sources.map((s) => s.id))}
        onConfirm={collectSources}
        max={Math.max(0, MAX_VIDEO_IMAGES - sources.length)}
        onRefresh={userImages.refresh}
      />

      <div className={styles.columns}>
        <div className={styles.clips}>
          {/* Above the wall, not under it (#504, #537): a statement about
              clips that are missing is no use in the place you reach after
              running out of clips. */}
          <HiddenBar
            hidden={visibility.hiddenImages.map((video) => ({
              id: video.id,
              // A clip's `title` is its model, which is the wrong word in a
              // tooltip that says "Show <this>". The prompt is what names the
              // take, and a clip made before prompts were stored falls back to
              // the word for the thing.
              title: video.description ?? 'clip',
            }))}
            onShowAll={() => void visibility.showAll()}
            onUnhide={(id: string) => void visibility.unhide([id])}
            focusCount={visibility.focusIds?.size ?? null}
            onClearFocus={visibility.clearFocus}
            noun={{ one: 'clip', many: 'clips' }}
          />

          <VideoList
            cells={cells}
            isInGroup={!!activeGroupId}
            onDelete={(id) => void deleteVideo(id)}
            onHide={(id) => void visibility.hide([id])}
            onContinue={(video) => void continueFrom(video)}
            onPlay={setPlayingId}
            continuingId={isContinuing}
            selectedIds={selectedIds}
            onSelect={toggleSelected}
            onOpenGroup={openGroup}
            onRenameGroup={(group) => setGroupFlow({ kind: 'rename', group })}
            onDissolveGroup={(group) =>
              setGroupFlow({ kind: 'confirm-dissolve', group })
            }
            onTrashGroup={(group) =>
              setGroupFlow({ kind: 'confirm-trash', group })
            }
            expandedGroupIds={expandedGroupIds}
            groupMembers={groupMembers}
            onToggleGroupMembers={toggleGroupMembers}
            workingByGroup={workingByGroup}
            hiddenByGroup={hiddenByGroup}
          />
        </div>

        <div className={styles.controls}>
          {/* The column is handed over while a selection is up: the form holds
              a prompt you are part-way through, but it is not what you are
              doing, and two stacks of controls in one column is neither. */}
          {selectionSurface === 'panel' ? (
            selectionActions
          ) : (
            <VideoForm
              durationOptions={durationOptions}
              promptCount={promptCount}
              needsConfirm={needsConfirm}
              prompts={prompts}
              onUpdatePrompt={updatePrompt}
              onAddPrompt={addPrompt}
              onRemovePrompt={removePrompt}
              onClearPrompts={clearPrompts}
              pendingCount={pendingCount}
              duration={duration}
              onDurationChange={setDuration}
              aspectRatio={aspectRatio}
              aspectOptions={aspectOptions}
              onAspectRatioChange={setAspectRatio}
              resolution={resolution}
              resolutionOptions={resolutionOptions}
              onResolutionChange={setResolution}
              estimatedCost={estimatedCost}
              isSubmitting={isSubmitting}
              canSubmit={canSubmit}
              onSubmit={submit}
              framesSlot={
                <ImageInputs
                  images={sources}
                  endpoint={endpoint}
                  disabled={isSubmitting}
                  onAdd={openPicker}
                  onRemove={removeSource}
                  onClear={clearSources}
                  onRoleChange={setImageRole}
                  error={compatibilityError}
                />
              }
              modelSlot={
                <ModelPicker
                  models={pickerModels}
                  selectedSlug={modelSlug}
                  images={sources}
                  resolution={resolution}
                  disabled={isSubmitting}
                  onSelect={selectModel}
                />
              }
            />
          )}
        </div>
      </div>

      {selectionSurface === 'drawer' && selectionActions}

      {/* Pick a group, or fall through to naming a new one. Never opened with
          an empty list -- `startAddToGroup` sends you straight to the name
          dialog instead. */}
      <GroupPickerDialog
        open={groupFlow?.kind === 'pick'}
        groups={groups}
        count={groupFlow?.kind === 'pick' ? groupFlow.targets.length : 0}
        description={
          groupFlow?.kind === 'pick'
            ? `${groupFlow.targets.length} clip${groupFlow.targets.length === 1 ? '' : 's'}`
            : undefined
        }
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
        onSubmit={(name) => void renameGroup(name)}
        onCancel={closeGroupFlow}
      />

      <ConfirmDialog
        open={groupFlow?.kind === 'confirm-dissolve'}
        title="Ungroup these clips?"
        message={
          groupFlow?.kind === 'confirm-dissolve'
            ? `All ${groupFlow.group.count} clip${groupFlow.group.count === 1 ? '' : 's'} go back to the top level. Only the group "${groupFlow.group.name}" goes away.`
            : ''
        }
        confirmLabel="Ungroup"
        destructive={false}
        onConfirm={() => void dissolveGroup()}
        onCancel={closeGroupFlow}
      />

      <ConfirmDialog
        open={groupFlow?.kind === 'confirm-trash'}
        title="Trash this group?"
        message={
          groupFlow?.kind === 'confirm-trash'
            ? groupFlow.group.count === 0
              ? `"${groupFlow.group.name}" is empty, so this just removes the group.`
              : `"${groupFlow.group.name}" and its ${groupFlow.group.count} clip${groupFlow.group.count === 1 ? '' : 's'} go to Trash. You can restore the clips from there.`
            : ''
        }
        confirmLabel="Trash group"
        onConfirm={() => void trashGroup()}
        onCancel={closeGroupFlow}
      />
    </Stack>
  )
}
