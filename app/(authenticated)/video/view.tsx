'use client'

import { Trash2 } from 'lucide-react'
import { ExistingImagePicker } from '../_components/existing-image-picker/existing-image-picker'
import { ModelSelector } from '../_components/model-selector/model-selector'
import { VideoForm } from './_components/video-form/video-form'
import { VideoList } from './_components/video-list/video-list'
import { useView } from './use-view'
import styles from './video.module.css'
import type { VideoRecord } from './_actions/generate-video.action'
import { frameCapacityFor } from '#/features/video/models'
import {
  Button,
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
    videos,
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
      <PageHeader
        title="Video"
        description="An image you already made, plus a note, comes back moving."
      />

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
            videos={videos}
            onDelete={(id) => void deleteVideo(id)}
            onContinue={(video) => void continueFrom(video)}
            playingId={playingId}
            onPlay={setPlayingId}
            continuingId={isContinuing}
            selectedIds={selectedIds}
            onSelect={toggleSelected}
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

      {/* One verb (#517). Images' drawer carries seven because a still is a
          thing you file, sheet and share; a clip is a take you either keep or
          prune, and the rest of what grouping would add is its own piece of
          work. Not `danger` and not "Delete": this moves rows to Trash, where
          they sit until it is emptied -- red belongs to Delete Forever. */}
      <SelectionDrawer count={selectedCount} onClear={clearSelection}>
        <Button
          size="sm"
          disabled={isBatchDeleting}
          onClick={() => void deleteSelected()}
        >
          <Trash2 size={14} />
          {isBatchDeleting ? 'Trashing...' : `Trash ${selectedCount}`}
        </Button>
      </SelectionDrawer>
    </Stack>
  )
}
