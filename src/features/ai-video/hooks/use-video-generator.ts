import { useState } from 'react'
import type { Generation, VideoSettings } from '@/features/ai-video/types'
import type { CreditsState } from '@/features/credits/hooks/use-credits'
import { DEFAULT_VIDEO_SETTINGS } from '@/features/ai-video/types'
import { generateFlfVideo } from '@/features/ai-video/server/generate-flf-video.server'
import { createGeneration } from '@/features/ai-video/server/create-generation.server'
import { updateGeneration } from '@/features/ai-video/server/update-generation.server'
import { CREDIT_COSTS } from '@/features/credits'
import { isCreditError } from '@/features/credits/handle-credit-error'

interface UseVideoGeneratorOptions {
  accessToken: string | undefined
  credits: CreditsState
  firstFrame: {
    status: string
    url: string | null
    recordId: string | null
  }
  lastFrame: {
    status: string
    url: string | null
    recordId: string | null
  }
  workspaceId: string
  generations: Array<Generation>
  addGeneration: (gen: Generation) => void
  updateGenerationRecord: (id: string, updates: Partial<Generation>) => void
}

export interface VideoGeneratorState {
  videoSettings: VideoSettings
  setVideoSettings: React.Dispatch<React.SetStateAction<VideoSettings>>
  generatingVideo: boolean
  handleGenerateVideo: () => Promise<void>
  handleGenerateVideoFromRow: (gen: Generation) => Promise<void>
}

export function useVideoGenerator({
  accessToken,
  credits,
  firstFrame,
  lastFrame,
  workspaceId,
  generations,
  addGeneration,
  updateGenerationRecord,
}: UseVideoGeneratorOptions): VideoGeneratorState {
  const [videoSettings, setVideoSettings] = useState<VideoSettings>({
    ...DEFAULT_VIDEO_SETTINGS,
  })
  const [generatingVideo, setGeneratingVideo] = useState(false)

  async function handleGenerateVideo() {
    if (
      !accessToken ||
      !firstFrame.recordId ||
      firstFrame.status !== 'completed'
    )
      return

    const hasLastFrame = lastFrame.recordId && lastFrame.status === 'completed'

    const cost = CREDIT_COSTS.video_gen
    if (credits.balance !== null && credits.balance < cost) {
      credits.showInsufficientCredits(cost)
      return
    }

    setGeneratingVideo(true)
    try {
      let genRecord = generations.find(
        (g) =>
          g.firstFrame?.id === firstFrame.recordId &&
          (hasLastFrame
            ? g.lastFrame?.id === lastFrame.recordId
            : !g.lastFrame) &&
          !g.video,
      )

      if (!genRecord) {
        const created = await createGeneration({
          data: {
            workspaceId,
            firstFrameId: firstFrame.recordId,
            lastFrameId: hasLastFrame ? lastFrame.recordId! : undefined,
            accessToken,
          },
        })
        genRecord = {
          id: created.id,
          createdAt: new Date().toISOString(),
          firstFrame: {
            id: firstFrame.recordId,
            url: firstFrame.url,
            status: 'completed',
          },
          lastFrame: hasLastFrame
            ? {
                id: lastFrame.recordId!,
                url: lastFrame.url,
                status: 'completed',
              }
            : null,
          video: null,
        }
        addGeneration(genRecord)
      }

      const result = await generateFlfVideo({
        data: {
          firstFrameRecordId: firstFrame.recordId,
          lastFrameRecordId: hasLastFrame ? lastFrame.recordId! : undefined,
          prompt: videoSettings.prompt,
          accessToken,
          duration: videoSettings.duration,
          cfgScale: videoSettings.cfgScale,
          negativePrompt: videoSettings.negativePrompt,
          videoModel: videoSettings.videoModel,
        },
      })

      await updateGeneration({
        data: {
          generationId: genRecord.id,
          videoId: result.recordId,
          accessToken,
        },
      })

      updateGenerationRecord(genRecord.id, {
        video: { id: result.recordId, url: null, status: 'pending' },
      })
      await credits.refresh()
    } catch (err) {
      if (isCreditError(err)) {
        credits.showInsufficientCredits(cost)
        credits.refresh()
      } else {
        console.error('Failed to generate video:', err)
      }
    } finally {
      setGeneratingVideo(false)
    }
  }

  async function handleGenerateVideoFromRow(gen: Generation) {
    if (!accessToken || !gen.firstFrame?.id) return

    const cost = CREDIT_COSTS.video_gen
    if (credits.balance !== null && credits.balance < cost) {
      credits.showInsufficientCredits(cost)
      return
    }

    try {
      const result = await generateFlfVideo({
        data: {
          firstFrameRecordId: gen.firstFrame.id,
          lastFrameRecordId: gen.lastFrame?.id || undefined,
          prompt: videoSettings.prompt,
          accessToken,
          duration: videoSettings.duration,
          cfgScale: videoSettings.cfgScale,
          negativePrompt: videoSettings.negativePrompt,
          videoModel: videoSettings.videoModel,
        },
      })

      await updateGeneration({
        data: {
          generationId: gen.id,
          videoId: result.recordId,
          accessToken,
        },
      })

      updateGenerationRecord(gen.id, {
        video: { id: result.recordId, url: null, status: 'pending' },
      })
      await credits.refresh()
    } catch (err) {
      if (isCreditError(err)) {
        credits.showInsufficientCredits(cost)
        credits.refresh()
      } else {
        console.error('Failed to generate video:', err)
      }
    }
  }

  return {
    videoSettings,
    setVideoSettings,
    generatingVideo,
    handleGenerateVideo,
    handleGenerateVideoFromRow,
  }
}
