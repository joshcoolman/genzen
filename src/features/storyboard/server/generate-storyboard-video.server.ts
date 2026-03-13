import { createServerFn } from '@tanstack/react-start'
import { fal } from '@fal-ai/client'
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'
import { checkAndDeductCredits } from '@/features/credits/server/check-credits.server'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

const STORYBOARD_VIDEO_MODEL = 'fal-ai/kling-video/v3/pro/image-to-video'

function clampDuration(seconds: number): string {
  return String(Math.max(3, Math.min(15, Math.round(seconds))))
}

async function fetchAndUploadCharRef(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch character ref image')
  const buffer = await res.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let mediaType: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg'
  if (bytes[0] === 0x89 && bytes[1] === 0x50) mediaType = 'image/png'
  else if (bytes[0] === 0x52 && bytes[1] === 0x49) mediaType = 'image/webp'
  return fal.storage.upload(new Blob([buffer], { type: mediaType }))
}

async function uploadFrameToFal(
  supabase: SupabaseClient,
  storagePath: string,
): Promise<string> {
  const { data: signedUrlData } = await supabase.storage
    .from('user-images')
    .createSignedUrl(storagePath, 3600)

  if (!signedUrlData?.signedUrl) {
    throw new Error('Failed to create signed URL for frame')
  }

  const res = await fetch(signedUrlData.signedUrl)
  if (!res.ok) throw new Error('Failed to fetch frame image')

  const buffer = await res.arrayBuffer()
  const bytes = new Uint8Array(buffer)

  let mediaType: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg'
  if (bytes[0] === 0x89 && bytes[1] === 0x50) mediaType = 'image/png'
  else if (bytes[0] === 0x52 && bytes[1] === 0x49) mediaType = 'image/webp'

  return fal.storage.upload(new Blob([buffer], { type: mediaType }))
}

interface SceneInput {
  image_id: string
  visual_description: string
  duration_seconds: number
  framing: string
  camera: string
  lighting: string
  lens: string
  angle: string
  characters: Array<string>
}

interface CharacterRef {
  slug: string
  url: string
}

interface GenerateClipInput {
  storyboardId: string
  accessToken: string
  scenes: Array<SceneInput>
  characterRefs: Array<CharacterRef>
  clipIndex: number
  clipCount: number
}

/** Build an enriched prompt from scene metadata */
function buildEnrichedPrompt(s: SceneInput, elementRefs: string): string {
  const parts: Array<string> = []

  // Cinematography prefix
  const cineParts: Array<string> = []
  if (s.framing) cineParts.push(`${s.framing} shot`)
  if (s.angle && s.angle !== 'eye level') cineParts.push(s.angle)
  if (s.lens) cineParts.push(`shot on ${s.lens}`)
  if (s.lighting) cineParts.push(s.lighting)
  if (cineParts.length > 0) parts.push(cineParts.join(', '))

  // Camera movement
  if (s.camera && s.camera !== 'static') parts.push(`${s.camera} camera`)

  // Character element references
  if (elementRefs) parts.push(elementRefs)

  // Core visual description
  parts.push(s.visual_description)

  const full = parts.join('. ')
  // Kling API enforces 512 char limit per prompt
  return full.length > 512 ? full.slice(0, 509) + '...' : full
}

/** Generate a single video clip from a group of scenes */
export const generateStoryboardClip = createServerFn({ method: 'POST' })
  .inputValidator((data: GenerateClipInput) => data)
  .handler(async ({ data }) => {
    const user = await requireAuth(data.accessToken)

    if (!process.env.FAL_KEY) {
      throw new Error('FAL_KEY environment variable is not set')
    }

    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${data.accessToken}` },
        },
      },
    )

    const { scenes, characterRefs } = data

    if (scenes.length < 1) {
      throw new Error('Need at least 1 scene to generate a clip')
    }

    // Deduct one credit
    const creditResult = await checkAndDeductCredits(
      data.accessToken,
      'video_gen',
    )
    if (!creditResult.allowed) {
      throw new Error('Insufficient credits for video generation')
    }

    // Fetch frame records for storage paths
    const sceneImageIds = scenes.map((s) => s.image_id)
    const { data: frameRecords } = await supabase
      .from('user_images')
      .select('id, storage_path')
      .in('id', sceneImageIds)
      .eq('user_id', user.id)
      .eq('status', 'completed')

    if (!frameRecords || frameRecords.length === 0) {
      throw new Error('Could not find frame records for scenes')
    }

    const frameMap = new Map(frameRecords.map((f) => [f.id, f.storage_path]))

    // Upload first scene's frame as the start image
    const firstPath = frameMap.get(scenes[0].image_id)
    if (!firstPath) {
      throw new Error('Frame not found for first scene')
    }
    const startImageUrl = await uploadFrameToFal(supabase, firstPath)

    // Upload character ref images to FAL storage and build elements array
    // Kling requires both frontal_image_url AND reference_image_urls
    const elements: Array<{
      frontal_image_url: string
      reference_image_urls: Array<string>
    }> = []
    const slugToElementIndex = new Map<string, number>()
    if (characterRefs.length > 0) {
      for (const ref of characterRefs) {
        try {
          const falUrl = await fetchAndUploadCharRef(ref.url)
          slugToElementIndex.set(ref.slug, elements.length + 1) // 1-indexed for @Element1
          elements.push({
            frontal_image_url: falUrl,
            reference_image_urls: [falUrl],
          })
        } catch (err) {
          console.warn(
            `[storyboard-video] Failed to upload char ref for ${ref.slug}:`,
            err,
          )
        }
      }
    }

    // Build enriched multi_prompt with cinematography and element refs
    const multiPrompt = scenes.map((s) => {
      // Build @Element references for characters in this scene
      const elementRefParts: Array<string> = []
      for (const charSlug of s.characters) {
        const idx = slugToElementIndex.get(charSlug)
        if (idx) elementRefParts.push(`@Element${idx}`)
      }
      const elementRefs = elementRefParts.join(' ')

      return {
        prompt: buildEnrichedPrompt(s, elementRefs),
        duration: clampDuration(s.duration_seconds),
      }
    })

    const totalDuration = scenes.reduce((sum, s) => sum + s.duration_seconds, 0)

    console.log(
      `[storyboard-video] Clip ${data.clipIndex + 1}/${data.clipCount}: ${scenes.length} shots, ${totalDuration}s, ${elements.length} elements`,
    )
    for (const mp of multiPrompt) {
      console.log(`[storyboard-video]   prompt: ${mp.prompt.slice(0, 120)}...`)
    }

    // Kling API: use multi_prompt OR prompt, never both
    const baseInput =
      multiPrompt.length > 1
        ? { multi_prompt: multiPrompt, start_image_url: startImageUrl }
        : {
            prompt: multiPrompt[0].prompt,
            duration: multiPrompt[0].duration,
            start_image_url: startImageUrl,
          }

    const input = {
      ...baseInput,
      aspect_ratio: '16:9' as const,
      generate_audio: false,
      negative_prompt: 'blur, distort, low quality, morphing, disfigured',
      ...(elements.length > 0 ? { elements } : {}),
    }

    const { request_id } = await fal.queue.submit(STORYBOARD_VIDEO_MODEL, {
      input,
    })

    const { data: record, error: insertError } = await supabase
      .from('user_images')
      .insert({
        user_id: user.id,
        request_id,
        status: 'pending',
        source: 'ai_video',
        title: `Storyboard clip ${data.clipIndex + 1}/${data.clipCount}`,
        generation_metadata: {
          generation_type: 'storyboard_video',
          storyboard_id: data.storyboardId,
          model: STORYBOARD_VIDEO_MODEL,
          clip_index: data.clipIndex,
          clip_count: data.clipCount,
          scene_count: scenes.length,
          total_duration: totalDuration,
          submitted_at: new Date().toISOString(),
        },
      })
      .select()
      .single()

    if (insertError) {
      throw new Error(`Failed to create video record: ${insertError.message}`)
    }

    // Store as the storyboard's video_record_id (first clip wins)
    if (data.clipIndex === 0) {
      await supabase
        .from('storyboards')
        .update({ video_record_id: record.id })
        .eq('id', data.storyboardId)
    }

    return { recordId: record.id, request_id }
  })
