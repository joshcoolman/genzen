'use client'

import { FolderMinus, FolderPlus, Trash2 } from 'lucide-react'
import { ExistingImagePicker } from '../_components/existing-image-picker/existing-image-picker'
import { ModelSelector } from '../_components/model-selector/model-selector'
import { GroupHeading } from '../_components/group-heading/group-heading'
import { GroupPickerDialog } from '../_components/group-picker-dialog/group-picker-dialog'
import { VideoForm } from './_components/video-form/video-form'
import { VideoList } from './_components/video-list/video-list'
import { useView } from './use-view'
import styles from './video.module.css'
import type { VideoRecord } from './_actions/generate-video.action'
import { frameCapacityFor } from '#/features/video/models'
import {
  Button,
  ConfirmDialog,
  NameDialog,
  PageHeader,
  RefImageStrip,
  SelectionDrawer,
  Stack,
} from '#/components'

export function View({ initialVideos }: { initialVideos: Array<VideoRecord> }) {
  const {
    pickerModels,
    modelSlug,
    selectModel,
    durationOptions,
    modelTakesEndFrame,
    modelTakesFirstFrame,
    aspectOptions,
    resolutionOptions,
    hasFirstFrame,
    userImages,
    sources,
    endSources,
    pickerTarget,
    setPickerTarget,
    openPicker,
    collectSources,
    clearSources,
    clearEndSources,
    cells,
    groups,
    expandedGroupIds,
    groupMembers,
    toggleGroupMembers,
    workingByGroup,
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
    playingId,
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

  return (
    <Stack gap={24}>
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
        open={pickerTarget !== null}
        onOpenChange={(open) => !open && setPickerTarget(null)}
        images={userImages.images}
        imageUrls={userImages.imageUrls}
        isLoading={userImages.isLoading}
        alreadyCollectedIds={
          new Set(
            (pickerTarget === 'last' ? endSources : sources).map((s) => s.id),
          )
        }
        onConfirm={collectSources}
        max={1}
        autoConfirm
      />

      <div className={styles.columns}>
        <div className={styles.clips}>
          <VideoList
            cells={cells}
            isInGroup={!!activeGroupId}
            onDelete={(id) => void deleteVideo(id)}
            onContinue={(video) => void continueFrom(video)}
            playingId={playingId}
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
          />
        </div>

        <div className={styles.controls}>
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
            /* Under the prompts, where the generator panel puts its reference
               strip. The generator panel's widget, twice, with one picker
               behind both -- a second dialog would be the same component
               mounted twice to answer the same question. Labelled, which that
               panel's single strip is not: two slots that do different things
               cannot both be unlabelled. */
            framesSlot={
              <>
                {/* Absent for a text-to-video-only model, not disabled: a slot
                    that cannot be sent anywhere is worse than no slot. What is
                    already staged is kept, so switching back restores it --
                    the frame is simply not sent meanwhile. */}
                {modelTakesFirstFrame && (
                  <div className={styles.frame}>
                    <p className={styles.frameLabel}>First frame (optional)</p>
                    <RefImageStrip
                      images={sources}
                      max={1}
                      onAdd={() => openPicker('first')}
                      onRemove={clearSources}
                      disabled={isSubmitting}
                    />
                  </div>
                )}

                {/* Optional, and it stays visible when empty rather than
                    hiding behind a disclosure -- an empty slot is the only
                    thing that says the capability exists. */}
                {modelTakesFirstFrame &&
                  modelTakesEndFrame &&
                  hasFirstFrame && (
                    <div className={styles.frame}>
                      <p className={styles.frameLabel}>Last frame (optional)</p>
                      <RefImageStrip
                        images={endSources}
                        max={1}
                        onAdd={() => openPicker('last')}
                        onRemove={clearEndSources}
                        disabled={isSubmitting}
                      />
                    </div>
                  )}
              </>
            }
            /* Last, as it is in the generator panel, and single-select: the
               controls above it are this model's, not an intersection of
               several models' (see the lineup's header comment). Its two
               right-hand columns are the same two numbers read differently --
               dollars per second, and frames rather than references. `price`
               is the model's headline rate; where it has resolution tiers the
               Resolution control moves the real figure, and `CostNote` is
               where that lands. */
            modelSlot={
              <ModelSelector
                mode="single"
                selectedIds={[modelSlug]}
                visibleModels={pickerModels.map((m) => ({
                  id: m.slug,
                  name: m.label,
                  description: m.description,
                  capability: 'video' as const,
                  price: m.pricePerSecondCents / 100,
                  capacity: frameCapacityFor(m),
                }))}
                onToggleSelected={selectModel}
                stagedImageCount={sources.length + endSources.length}
                priceLabel="$/s"
                capacityLabel="Frames"
                persistKey="genzen:video:model-panel:expanded"
              />
            }
          />
        </div>
      </div>

      {/* Three verbs, against Images' seven (#517). A still is a thing you
          file, sheet, zip and share; a clip is a take you group or prune.
          There is no reference sheet -- a sheet of clips is not a thing -- and
          no zip in this pass. */}
      <SelectionDrawer count={selectedCount} onClear={clearSelection}>
        <Button
          variant="secondary"
          size="sm"
          disabled={isBatchDeleting}
          onClick={startAddToGroup}
        >
          <FolderPlus size={14} />
          Add to group
        </Button>
        {/* Only inside a group: the mirror of Add to group, and it should look
            like one -- a folder losing an item, not a broken link. */}
        {activeGroupId && (
          <Button
            variant="secondary"
            size="sm"
            disabled={isBatchDeleting}
            onClick={() => void removeFromGroup()}
          >
            <FolderMinus size={14} />
            Remove from group
          </Button>
        )}
        {/* Not `danger` and not "Delete": this moves rows to Trash, where they
            sit until it is emptied -- red belongs to Delete Forever. */}
        <Button
          size="sm"
          disabled={isBatchDeleting}
          onClick={() => void deleteSelected()}
        >
          <Trash2 size={14} />
          {isBatchDeleting ? 'Trashing...' : `Trash ${selectedCount}`}
        </Button>
      </SelectionDrawer>

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
