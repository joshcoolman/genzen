import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'
import { createImageStorage } from '@/lib/image-storage'

interface GetGenerationsInput {
  workspaceId: string
  accessToken: string
}

export const getGenerations = createServerFn({ method: 'POST' })
  .inputValidator((data: GetGenerationsInput) => data)
  .handler(async ({ data }) => {
    const user = await requireAuth(data.accessToken)

    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${data.accessToken}` },
        },
      },
    )

    const { data: generations, error } = await supabase
      .from('video_generations')
      .select(
        `
        id,
        created_at,
        first_frame:first_frame_id(id, status, storage_path, generation_metadata),
        last_frame:last_frame_id(id, status, storage_path, generation_metadata),
        video:video_id(id, status, storage_path, generation_metadata)
        `,
      )
      .eq('workspace_id', data.workspaceId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch generations: ${error.message}`)
    }

    // Resolve signed URLs for stored frames, use fal_url for videos
    const results = await Promise.all(
      generations.map(async (gen) => {
        type FrameRow = {
          id: string
          status?: string
          storage_path: string | null
          generation_metadata: Record<string, unknown> | null
        }
        const firstFrame = gen.first_frame as unknown as FrameRow | null
        const lastFrame = gen.last_frame as unknown as FrameRow | null
        const video = gen.video as unknown as FrameRow | null

        const storage = createImageStorage(supabase)
        let firstFrameUrl: string | null = null
        let lastFrameUrl: string | null = null
        let videoUrl: string | null = null

        if (firstFrame?.storage_path) {
          firstFrameUrl = await storage.getUrl(firstFrame.storage_path)
        }

        if (lastFrame?.storage_path) {
          lastFrameUrl = await storage.getUrl(lastFrame.storage_path)
        }

        if (video) {
          videoUrl =
            (video.generation_metadata?.fal_url as string | undefined) ?? null
        }

        const firstFrameStatus = firstFrame
          ? ((firstFrame.status ?? 'completed') as
              | 'pending'
              | 'completed'
              | 'failed')
          : undefined
        const lastFrameStatus = lastFrame
          ? ((lastFrame.status ?? 'completed') as
              | 'pending'
              | 'completed'
              | 'failed')
          : undefined

        return {
          id: gen.id as string,
          createdAt: gen.created_at as string,
          firstFrame: firstFrame
            ? {
                id: firstFrame.id,
                url: firstFrameUrl,
                status: firstFrameStatus,
              }
            : null,
          lastFrame: lastFrame
            ? { id: lastFrame.id, url: lastFrameUrl, status: lastFrameStatus }
            : null,
          video: video
            ? {
                id: video.id,
                url: videoUrl,
                status: (video.status ?? 'completed') as
                  | 'pending'
                  | 'completed'
                  | 'failed',
              }
            : null,
          videoPrompt:
            (video?.generation_metadata?.transition_prompt as
              | string
              | undefined) ??
            (video?.generation_metadata?.prompt as string | undefined) ??
            undefined,
        }
      }),
    )

    return results
  })
