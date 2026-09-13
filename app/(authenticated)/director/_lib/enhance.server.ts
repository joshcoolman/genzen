import 'server-only'
import { z } from 'zod'
import { Output, generateText } from 'ai'
import { settingsSchema } from '../clips'
import { requireSession } from './sessions.server'
import { readMedia } from './media.server'
import { ai, requireAiRole } from '#/lib/server/ai.server'
import instructions from '#/lib/prompts/director-enhance.md'

export const enhancedSchema = z.object({
  direction: z.string(),
  fit: z.string(),
})

/**
 * Rewriting one section's direction, with the section's own context: the frame
 * it starts on, the frame it must end on, its duration, and what came before.
 *
 * Director-owned rather than ai-images' `enhancePrompt`: that one has neither
 * frames nor continuity, and a shared enhancer could only vary the wording.
 * Writes into the dialog's box, never straight to a generation -- no FAL call
 * and nothing is spent here.
 */
export async function enhanceSection(
  owner: string,
  id: string,
  index: number,
  prompt: string,
  duration: number,
) {
  index = z.number().int().min(0).max(49).parse(index)
  prompt = z.string().trim().min(1).max(2000).parse(prompt)
  const seconds = settingsSchema.shape.duration.parse(duration)
  requireAiRole('vision')
  const session = await requireSession(owner, id)
  const clips = session.cut.clips
  if (index >= clips.length) throw new Error('That section no longer exists.')
  const startId =
    index > 0 ? clips[index - 1].endFrameId : session.cut.initialImage
  // The same seam the generation is pinned to: the next section opened on this
  // clip's ending frame, so the rewrite has to land there too.
  const endId = index < clips.length - 1 ? clips[index].endFrameId : null
  const frames = []
  for (const [role, mediaId] of [
    ['starting frame', startId],
    ['ending frame', endId],
  ] as const) {
    if (!mediaId) continue
    const blob = await readMedia(owner, mediaId)
    frames.push({ role, blob })
  }
  const { output } = await generateText({
    model: ai.vision,
    system: instructions,
    output: Output.object({ schema: enhancedSchema }),
    // Native output_format rejects our bounds; tool output accepts the schema.
    providerOptions: { anthropic: { structuredOutputMode: 'jsonTool' } },
    maxOutputTokens: 1500,
    abortSignal: AbortSignal.timeout(120000),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              duration: seconds,
              direction: prompt,
              priorDirections: clips.slice(0, index).map((clip) => clip.prompt),
              framesAttached: frames.map((frame) => frame.role),
            }),
          },
          ...(await Promise.all(
            frames.map(async (frame) => ({
              type: 'image' as const,
              image: new Uint8Array(await frame.blob.arrayBuffer()),
              mediaType: frame.blob.type,
            })),
          )),
        ],
      },
    ],
  })
  const direction = output.direction.trim()
  if (!direction) throw new Error('The model returned an empty direction.')
  return { direction, fit: output.fit.trim() }
}
