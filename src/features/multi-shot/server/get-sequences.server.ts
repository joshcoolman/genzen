import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { DEFAULT_SETTINGS } from '../types'
import type { MultiShotSequence } from '../types'
import { requireAuth } from '@/lib/server/auth.server'
import { createImageStorage } from '@/lib/image-storage'

function parseJsonb<T>(value: unknown, fallback: T): T {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T
    } catch {
      return fallback
    }
  }
  return (value as T) ?? fallback
}

/**
 * Extract the storage path from a Supabase signed URL.
 * Signed URLs: /storage/v1/object/sign/user-images/<path>?token=...
 */
function extractStoragePath(url: string): string | null {
  const match = url.match(
    /\/storage\/v1\/object\/sign\/user-images\/(.+?)(?:\?|$)/,
  )
  return match ? decodeURIComponent(match[1]) : null
}

async function refreshUrl(supabase: any, url: string): Promise<string> {
  const storagePath = extractStoragePath(url)
  if (!storagePath) return url
  const signedUrl = await createImageStorage(supabase).getUrl(storagePath, {
    ttl: 3600,
    cached: false,
  })
  return signedUrl || url
}

interface GetSequencesInput {
  accessToken: string
}

export const getSequences = createServerFn({ method: 'POST' })
  .inputValidator((data: GetSequencesInput) => data)
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

    const { data: sequences, error } = await supabase
      .from('multishot_sequences')
      .select(
        'id, name, shots, elements, settings, video_record_id, status, estimated_cost, created_at',
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch sequences: ${error.message}`)

    // Batch-fetch linked user_images to get real status + video URL
    const videoRecordIds = sequences
      .map((s) => s.video_record_id)
      .filter((id): id is string => !!id)

    let videoRecordsMap: Record<
      string,
      { status: string; generation_metadata: Record<string, unknown> | null }
    > = {}
    if (videoRecordIds.length > 0) {
      const { data: records } = await supabase
        .from('user_images')
        .select('id, status, generation_metadata')
        .in('id', videoRecordIds)
      if (records) {
        videoRecordsMap = Object.fromEntries(records.map((r) => [r.id, r]))
      }
    }

    return Promise.all(
      sequences.map(async (s): Promise<MultiShotSequence> => {
        const videoRecord = s.video_record_id
          ? videoRecordsMap[s.video_record_id]
          : null

        // Derive status from the linked user_images record
        let status = s.status as MultiShotSequence['status']
        let videoUrl: string | null = null
        if (videoRecord) {
          if (videoRecord.status === 'completed') {
            status = 'completed'
            const meta = videoRecord.generation_metadata || {}
            videoUrl = (meta.fal_url as string) || null
          } else if (videoRecord.status === 'failed') {
            status = 'failed'
          }
        }

        const settings = {
          ...DEFAULT_SETTINGS,
          ...(parseJsonb(s.settings, {}) as Record<string, unknown>),
        } as MultiShotSequence['settings']

        // Re-sign start image URL for card thumbnails
        if (settings.startImageUrl) {
          settings.startImageUrl = await refreshUrl(
            supabase,
            settings.startImageUrl,
          )
        }

        return {
          id: s.id,
          name: s.name,
          shots: parseJsonb(s.shots, []) as MultiShotSequence['shots'],
          elements: parseJsonb(s.elements, []) as MultiShotSequence['elements'],
          settings,
          videoRecordId: s.video_record_id,
          status,
          estimatedCost: s.estimated_cost,
          videoUrl,
          createdAt: s.created_at,
        }
      }),
    )
  })
