'use client'

import { ExistingImagePicker } from '../_components/existing-image-picker/existing-image-picker'
import { ModelSelector } from '../_components/model-selector/model-selector'
import { VideoForm } from './_components/video-form/video-form'
import { VideoList } from './_components/video-list/video-list'
import { useView } from './use-view'
import styles from './video.module.css'
import type { VideoRecord } from './_actions/generate-video.action'
import { frameCapacityFor } from '#/features/video/models'
import { PageHeader, RefImageStrip, Stack } from '#/components'

export function View({ initialVideos }: { initialVideos: Array<VideoRecord> }) {
  const {
    model,
    models,
    selectModel,
    modelTakesEndFrame,
    aspectOptions,
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
    deleteVideo,
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
    estimatedCost,
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
          <VideoList videos={videos} onDelete={(id) => void deleteVideo(id)} />
        </div>

        <div className={styles.controls}>
          <VideoForm
            model={model}
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

                {/* Optional, and it stays visible when empty rather than
                    hiding behind a disclosure -- an empty slot is the only
                    thing that says the capability exists. */}
                {modelTakesEndFrame && hasFirstFrame && (
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
            /* Last, as it is in the generator panel. Single-select (#385): a
               clip is 20-100x the price of a still, so ticking four models
               would be a $20 click. Its two right-hand columns are the same
               two numbers read differently -- dollars per second, and frames
               rather than references. No header tick and no Cmd-click solo,
               because with one selection both mean nothing. */
            modelSlot={
              <ModelSelector
                mode="single"
                selectedIds={[model.slug]}
                visibleModels={models.map((m) => ({
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
    </Stack>
  )
}
