'use client'

import { SourcePicker } from './_components/source-picker/source-picker'
import { VideoForm } from './_components/video-form/video-form'
import { VideoList } from './_components/video-list/video-list'
import { useView } from './use-view'
import type { VideoSource } from './use-view'
import type { VideoRecord } from './_actions/generate-video.action'
import { PageHeader, Stack } from '#/components'

export function View({
  initialVideos,
  sources,
}: {
  initialVideos: Array<VideoRecord>
  sources: Array<VideoSource>
}) {
  const {
    model,
    sourceId,
    setSourceId,
    videos,
    prompt,
    setPrompt,
    duration,
    setDuration,
    aspectRatio,
    setAspectRatio,
    estimatedCost,
    isSubmitting,
    canSubmit,
    submit,
  } = useView(initialVideos, sources)

  return (
    <Stack gap={24}>
      <PageHeader
        title="Video"
        description="An image you already made, plus a note, comes back moving."
      />

      <SourcePicker
        sources={sources}
        selectedId={sourceId}
        onSelect={setSourceId}
      />

      <VideoForm
        model={model}
        prompt={prompt}
        onPromptChange={setPrompt}
        duration={duration}
        onDurationChange={setDuration}
        aspectRatio={aspectRatio}
        onAspectRatioChange={setAspectRatio}
        estimatedCost={estimatedCost}
        isSubmitting={isSubmitting}
        canSubmit={canSubmit}
        onSubmit={submit}
      />

      <VideoList videos={videos} />
    </Stack>
  )
}
