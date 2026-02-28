import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'

interface GetVideoUrlInput {
  generationId: string
  accessToken: string
}

export const getVideoUrl = createServerFn({ method: 'POST' })
  .inputValidator((data: GetVideoUrlInput) => data)
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

    const { data: gen, error } = await supabase
      .from('video_generations')
      .select('video:video_id(generation_metadata)')
      .eq('id', data.generationId)
      .eq('user_id', user.id)
      .single()

    if (error) {
      return { videoUrl: null }
    }

    const video = gen.video as unknown as {
      generation_metadata: Record<string, unknown> | null
    } | null

    const videoUrl =
      (video?.generation_metadata?.fal_url as string | undefined) ?? null

    return { videoUrl }
  })
