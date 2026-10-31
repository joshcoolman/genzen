'use server'

import { fal } from './client.server'
import { describeThrown } from './error.server'
import { withNetworkRetry } from './retry.server'
import { resolveAuth } from '#/lib/server/auth.server'

/** Ten minutes of speech at the bitrates browsers record at is well under
 *  this; anything bigger is not a prompt. */
const MAX_AUDIO_BYTES = 10 * 1024 * 1024

export type TranscribeResult =
  | { ok: true; text: string }
  | { ok: false; error: string }

/**
 * Spoken prompt to text (#811), with Whisper v3 large on FAL (`fal-ai/wizper`).
 *
 * The browser records whatever it can -- `audio/mp4` on iPhone Safari,
 * `audio/webm` on Chrome and Firefox -- and Whisper takes both, so nothing is
 * converted here. The clip goes to FAL storage rather than through
 * `uploadBufferToFal`, which is the image path and would try to shrink it.
 *
 * Returns a result rather than throwing: a thrown action error reaches the
 * browser as a generic message in production, and "no speech heard" is worth
 * saying as itself.
 */
export async function transcribeAudio(
  form: FormData,
): Promise<TranscribeResult> {
  await resolveAuth()
  if (!process.env.FAL_KEY) return { ok: false, error: 'FAL_KEY is not set.' }

  const audio = form.get('audio')
  if (!(audio instanceof Blob) || audio.size === 0)
    return { ok: false, error: 'No audio was recorded.' }
  if (audio.size > MAX_AUDIO_BYTES)
    return { ok: false, error: 'That recording is too long.' }

  try {
    const audioUrl = await withNetworkRetry('storage.upload', () =>
      fal.storage.upload(audio),
    )
    const result = await fal.subscribe('fal-ai/wizper', {
      input: { audio_url: audioUrl, task: 'transcribe', language: 'en' },
    })
    const text = String(
      (result.data as { text?: unknown } | undefined)?.text ?? '',
    ).trim()
    if (!text) return { ok: false, error: 'No speech was heard.' }
    return { ok: true, text }
  } catch (err) {
    console.error('[transcribe]', describeThrown(err))
    return { ok: false, error: 'Transcription failed. Try again.' }
  }
}
