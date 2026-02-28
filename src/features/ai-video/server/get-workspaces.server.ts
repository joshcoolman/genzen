import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'

interface GetWorkspacesInput {
  accessToken: string
}

export const getWorkspaces = createServerFn({ method: 'POST' })
  .inputValidator((data: GetWorkspacesInput) => data)
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

    const { data: workspaces, error } = await supabase
      .from('video_workspaces')
      .select(
        `
        id, name, created_at,
        video_generations(
          id, created_at,
          first_frame:first_frame_id(id, storage_path, generation_metadata),
          last_frame:last_frame_id(id, storage_path)
        )
      `,
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch workspaces: ${error.message}`)
    }

    type FrameRow = {
      id: string
      storage_path: string | null
      generation_metadata?: Record<string, unknown> | null
    }

    const results = await Promise.all(
      workspaces.map(async (w) => {
        const gens = w.video_generations as unknown as Array<{
          id: string
          created_at: string
          first_frame: FrameRow | null
          last_frame: FrameRow | null
        }>

        // Sort by most recent first, cap at 50
        const sorted = [...gens]
          .sort(
            (a, b) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime(),
          )
          .slice(0, 50)

        // Sign first_frame URLs for all capped gens in one pass
        const signedFirstFrameUrls = await Promise.all(
          sorted.map(async (gen) => {
            if (!gen.first_frame?.storage_path) return null
            const { data } = await supabase.storage
              .from('user-images')
              .createSignedUrl(gen.first_frame.storage_path, 3600)
            return data?.signedUrl ?? null
          }),
        )

        const heroUrl = signedFirstFrameUrls[0] ?? null

        // Last frame from most recent generation
        let lastFrameUrl: string | null = null
        if (sorted.length > 0 && sorted[0].last_frame?.storage_path) {
          const { data } = await supabase.storage
            .from('user-images')
            .createSignedUrl(sorted[0].last_frame.storage_path, 3600)
          lastFrameUrl = data?.signedUrl ?? null
        }

        // Extract prompt from most recent generation_metadata
        let prompt: string | null = null
        if (sorted.length > 0) {
          const meta = sorted[0].first_frame?.generation_metadata
          if (meta?.prompt && typeof meta.prompt === 'string') {
            prompt = meta.prompt
          }
        }

        // Thumbnails from other generations (up to 4 first_frames after the hero)
        const thumbnailUrls = signedFirstFrameUrls
          .slice(1, 5)
          .filter((url): url is string => url !== null)

        // Per-generation entries for the Everything feed
        const generations = sorted.map((gen, i) => ({
          id: gen.id,
          createdAt: gen.created_at,
          firstFrameUrl: signedFirstFrameUrls[i] ?? null,
        }))

        return {
          id: w.id as string,
          name: w.name as string,
          createdAt: w.created_at as string,
          generationCount: gens.length,
          preview: {
            heroUrl,
            lastFrameUrl,
            thumbnailUrls,
            prompt,
          },
          generations,
        }
      }),
    )

    return results
  })
