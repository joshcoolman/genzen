'use client'

import { ExistingImagePicker } from '../_components/existing-image-picker/existing-image-picker'
import { VideoForm } from './_components/video-form/video-form'
import { VideoList } from './_components/video-list/video-list'
import { useView } from './use-view'
import styles from './video.module.css'
import type { VideoRecord } from './_actions/generate-video.action'
import { PageHeader, RefImageStrip, Stack } from '#/components'

export function View({ initialVideos }: { initialVideos: Array<VideoRecord> }) {
  const {
    model,
    userImages,
    sources,
    pickerOpen,
    setPickerOpen,
    openPicker,
    collectSources,
    clearSources,
    videos,
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
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        images={userImages.images}
        imageUrls={userImages.imageUrls}
        isLoading={userImages.isLoading}
        alreadyCollectedIds={new Set(sources.map((s) => s.id))}
        onConfirm={collectSources}
        max={1}
        autoConfirm
      />

      <div className={styles.columns}>
        <div className={styles.clips}>
          <VideoList videos={videos} />
        </div>

        <div className={styles.controls}>
          <Stack gap={16}>
            {/* The same widget the generator panel uses for Reference images, and the
              same picker behind it. One slot, because the endpoint takes a single
              first frame. */}
            <div className={styles.source}>
              <p className={styles.sourceLabel}>First frame</p>
              <RefImageStrip
                images={sources}
                max={1}
                onAdd={openPicker}
                onRemove={clearSources}
                disabled={isSubmitting}
              />
            </div>

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
              onAspectRatioChange={setAspectRatio}
              estimatedCost={estimatedCost}
              isSubmitting={isSubmitting}
              canSubmit={canSubmit}
              onSubmit={submit}
            />
          </Stack>
        </div>
      </div>
    </Stack>
  )
}
