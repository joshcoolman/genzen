import type {
  SavedAiVideo,
  VideoGenerationMetadata,
} from '@/features/ai-video/video-types'
import type { VideoSidebarState } from '@/features/ai-video/hooks/use-video-sidebar'

/**
 * Synthesize a pending SavedAiVideo row from the sidebar snapshot so the
 * gallery can render a real-looking card the same frame as the click.
 * The id is client-minted; the server will persist under the same id.
 */
export function buildPendingVideo(
  id: string,
  state: VideoSidebarState,
  sessionParentId: string | null,
): SavedAiVideo {
  const createdAt = new Date().toISOString()

  const metadata: VideoGenerationMetadata =
    state.mode === 'flf'
      ? {
          method: 'flf',
          parent_id: sessionParentId,
          model: state.videoModel,
          prompt: state.prompt,
          transition_prompt: state.prompt,
          first_frame_url: state.firstFrameUrl,
          first_frame_id: state.firstFrameRecordId ?? undefined,
          last_frame_url: state.lastFrameUrl,
          last_frame_id: state.lastFrameRecordId ?? undefined,
          duration: state.duration,
          cfg_scale: state.cfgScale,
          negative_prompt: state.negativePrompt || null,
          submitted_at: createdAt,
        }
      : {
          method: 'multishot',
          parent_id: sessionParentId,
          shots: state.shots,
          elements: state.elements,
          start_image_url: state.firstFrameUrl ?? '',
          aspect_ratio: state.aspectRatio,
          shot_type: state.shotType,
          generate_audio: state.generateAudio,
          submitted_at: createdAt,
        }

  return {
    id,
    title: 'AI Video',
    storage_path: null,
    thumbnail_path: null,
    created_at: createdAt,
    sort_order: Date.now() / 1000,
    status: 'pending',
    generation_error: null,
    generation_metadata: metadata,
  }
}
