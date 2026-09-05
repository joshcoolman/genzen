import 'server-only'
import { APICallError, Output, generateText } from 'ai'
import { planSchema, validatePlan } from './final-cut'
import { readMedia } from './media.server'
import type { FinalWork } from './final-cut'
import type { SavedExport } from './types'
import { ai, requireAiRole } from '#/lib/server/ai.server'
import instructions from '#/lib/prompts/director-final-cut.md'

export function planningWasRejected(error: unknown) {
  return (
    APICallError.isInstance(error) &&
    [400, 401, 403, 404, 422].includes(error.statusCode ?? 0)
  )
}

export async function planFinalCut(
  owner: string,
  source: SavedExport,
  frames: NonNullable<FinalWork['frames']>,
) {
  requireAiRole('vision')
  const images = []
  for (const frame of frames) {
    const blob = await readMedia(owner, frame.mediaId)
    images.push({
      type: 'image' as const,
      image: new Uint8Array(await blob.arrayBuffer()),
      mediaType: blob.type,
    })
  }
  const { output } = await generateText({
    model: ai.vision,
    system: instructions,
    output: Output.object({ schema: planSchema }),
    // Native output_format rejects maxItems and numeric bounds. Tool output
    // accepts the schema; our validator still enforces every production bound.
    providerOptions: { anthropic: { structuredOutputMode: 'jsonTool' } },
    maxRetries: 0,
    maxOutputTokens: 12000,
    abortSignal: AbortSignal.timeout(240000),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              duration: source.duration,
              budgetSeconds: Math.min(120, Math.ceil(source.duration / 5) * 5),
              sections: source.source.map((clip, index) => ({
                index,
                direction: clip.prompt,
                duration: clip.duration,
              })),
              frames: frames.map((frame, index) => ({
                index,
                time: frame.time,
                section: frame.section,
              })),
            }),
          },
          ...images,
        ],
      },
    ],
  })
  return validatePlan(output, source, frames.length)
}
