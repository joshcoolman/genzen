import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { DEFAULT_SETTINGS } from '../types'
import type { MultiShotSequence } from '../types'
import { requireAuth } from '@/lib/server/auth.server'

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
 * Signed URLs look like: https://<project>.supabase.co/storage/v1/object/sign/user-images/<path>?token=...
 * Returns null if not a Supabase signed URL.
 */
function extractStoragePath(url: string): string | null {
  const match = url.match(
    /\/storage\/v1\/object\/sign\/user-images\/(.+?)(?:\?|$)/,
  )
  return match ? decodeURIComponent(match[1]) : null
}

/** Re-sign a URL if it's an expired Supabase signed URL, otherwise return as-is */

async function refreshUrl(supabase: any, url: string): Promise<string> {
  const storagePath = extractStoragePath(url)
  if (!storagePath) return url // FAL URL or other public URL, leave as-is

  const { data } = await supabase.storage
    .from('user-images')
    .createSignedUrl(storagePath, 3600)

  return data?.signedUrl || url
}

interface GetSequenceInput {
  accessToken: string
  sequenceId: string
}

export const getSequence = createServerFn({ method: 'POST' })
  .inputValidator((data: GetSequenceInput) => data)
  .handler(async ({ data }): Promise<MultiShotSequence> => {
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

    const { data: s, error } = await supabase
      .from('multishot_sequences')
      .select(
        'id, name, shots, elements, settings, video_record_id, status, estimated_cost, created_at',
      )
      .eq('id', data.sequenceId)
      .eq('user_id', user.id)
      .single()

    if (error) throw new Error(`Sequence not found: ${error.message}`)

    // Derive status from linked user_images record
    let status = s.status as MultiShotSequence['status']
    let videoUrl: string | null = null
    if (s.video_record_id) {
      const { data: record } = await supabase
        .from('user_images')
        .select('status, generation_metadata')
        .eq('id', s.video_record_id)
        .single()

      if (record) {
        if (record.status === 'completed') {
          status = 'completed'
          const meta = record.generation_metadata as Record<string, unknown>
          videoUrl = (meta?.fal_url as string) || null
        } else if (record.status === 'failed') {
          status = 'failed'
        }
      }
    }

    const elements = parseJsonb(s.elements, []) as MultiShotSequence['elements']
    const settings = {
      ...DEFAULT_SETTINGS,
      ...(parseJsonb(s.settings, {}) as Record<string, unknown>),
    } as MultiShotSequence['settings']

    // Re-sign any expired Supabase signed URLs in elements and start image
    const refreshedElements = await Promise.all(
      elements.map(async (el) => ({
        ...el,
        frontalImageUrl: await refreshUrl(supabase, el.frontalImageUrl),
      })),
    )
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
      elements: refreshedElements,
      settings,
      videoRecordId: s.video_record_id,
      status,
      estimatedCost: s.estimated_cost,
      videoUrl,
      createdAt: s.created_at,
    }
  })
