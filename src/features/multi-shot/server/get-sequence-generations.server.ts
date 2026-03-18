import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import type { GenerationRecord } from '../types'
import { requireAuth } from '@/lib/server/auth.server'

interface GetSequenceGenerationsInput {
  accessToken: string
  sequenceId: string
}

export const getSequenceGenerations = createServerFn({ method: 'POST' })
  .inputValidator((data: GetSequenceGenerationsInput) => data)
  .handler(async ({ data }): Promise<Array<GenerationRecord>> => {
    await requireAuth(data.accessToken)

    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${data.accessToken}` },
        },
      },
    )

    const { data: records, error } = await supabase
      .from('user_images')
      .select('id, status, generation_metadata, created_at')
      .eq('generation_metadata->>sequence_id', data.sequenceId)
      .eq('generation_metadata->>type', 'multishot')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch generations: ${error.message}`)

    return records.map((r): GenerationRecord => {
      const meta = r.generation_metadata as Record<string, unknown>
      return {
        id: r.id,
        status: r.status as GenerationRecord['status'],
        videoUrl: (meta.fal_url as string) || null,
        error: (meta.error as string) || null,
        createdAt: r.created_at,
        thumbnailUrl: (meta.thumbnail_url as string) || null,
      }
    })
  })
