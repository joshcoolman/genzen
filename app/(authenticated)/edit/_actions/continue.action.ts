'use server'

import fallback from '#/lib/prompts/edit-continue.md'
import { generateVideo } from '../../video/_actions/generate-video.action'

/**
 * Make the clip between two frames (#731).
 *
 * Video's `generateVideo`, with the edit's origin and one thing on top: a
 * blank prompt with both frames set sends the fallback line, so "let the
 * model find its way between them" is a real request rather than a refused
 * one. The line is prose and lives in `src/lib/prompts/` (#322).
 */
export async function continueClip({
  firstId,
  lastId,
  prompt,
  duration,
  aspectRatio,
  resolution,
  modelSlug,
}: {
  firstId: string
  lastId: string | null
  prompt: string
  duration: number
  aspectRatio: string
  resolution?: string
  modelSlug: string
}) {
  const text = prompt.trim() || (lastId ? fallback.trim() : '')
  if (!text) throw new Error('Say what happens next.')
  return generateVideo({
    images: [
      { id: firstId, role: 'first' },
      ...(lastId ? [{ id: lastId, role: 'last' as const }] : []),
    ],
    prompt: text,
    duration,
    aspectRatio,
    resolution,
    modelSlug,
    origin: 'edit',
  })
}
