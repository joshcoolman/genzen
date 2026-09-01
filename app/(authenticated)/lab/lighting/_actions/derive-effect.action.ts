'use server'

import { generateObject } from 'ai'
import { z } from 'zod'
import { slugify } from '../effect-file'
import derivePrompt from '#/lib/prompts/lighting/derive.md'
import { resolveAuth } from '#/lib/server/auth.server'
import { first, sql } from '#/lib/server/db.server'
import { ai, requireAiRole } from '#/lib/server/ai.server'
import { loadVisionImage } from '#/lib/server/vision-image.server'

/**
 * Pass one of #562: a reference photograph in, a lighting setup out.
 *
 * **The output is prose in the shape `src/lib/prompts/lighting/` already
 * uses**, because the only thing that makes this surface worth building is
 * that what comes out of it can be pasted into that folder unchanged. Same
 * bullets, same `{TOKEN}` gels, same prohibition on naming anything in the
 * picture -- the rules are in `derive.md` and the reasons behind each of them
 * are in `src/lib/prompts/lighting/index.ts`, which learned them the expensive
 * way.
 *
 * **Sonnet, not Haiku.** The whole job is looking hard at where light falls and
 * inferring fixtures from it; this is the same call `describeImageJson` makes
 * and for the same reason (#254).
 *
 * **It throws with no ANTHROPIC_API_KEY rather than degrading**, per #365. A
 * derive that quietly returned a generic setup would be indistinguishable from
 * one that worked until four candidates came back looking like nothing in
 * particular.
 */

const schema = z.object({
  name: z
    .string()
    .describe('Two or three words naming what the setup does, title case'),
  setup: z
    .string()
    .describe(
      'The setup as markdown: one opening line, then bolded bullets. No heading.',
    ),
  gels: z
    .array(
      z.object({
        token: z
          .string()
          .describe('UPPER_SNAKE token as it appears in the setup, no braces'),
        color: z
          .string()
          .describe(
            'The colour it stands for, as a phrase: "a deep cyan-teal"',
          ),
      }),
    )
    .describe(
      'Every token used in the setup, with the colour seen in the reference',
    ),
})

export interface DerivedEffect {
  /** Slug, and the filename the effect would get. */
  id: string
  name: string
  setup: string
  gels: Array<{ token: string; color: string }>
}

export async function deriveLightingEffect(data: {
  imageId: string
}): Promise<DerivedEffect> {
  const { userId } = await resolveAuth()
  requireAiRole('vision')

  if (!/^[0-9a-f-]{36}$/i.test(data.imageId)) throw new Error('Invalid imageId')

  const row = first(
    await sql<Array<{ storage_path: string | null }>>`
      select storage_path from user_images
      where id = ${data.imageId} and user_id = ${userId}
    `,
  )
  if (!row?.storage_path) throw new Error('Reference image not found')

  // Bytes off the bucket, sized for a vision call -- there is no URL to fetch
  // since #226, and an original is a request that fails rather than a better
  // answer (#436).
  const image = await loadVisionImage(row.storage_path)
  if (!image) throw new Error('Could not read the reference image')

  const { object } = await generateObject({
    model: ai.vision,
    maxOutputTokens: 2048,
    system: derivePrompt,
    schema,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            image: `data:${image.mediaType};base64,${image.data}`,
          },
          {
            type: 'text',
            text: 'Write the lighting setup that produced this.',
          },
        ],
      },
    ],
  })

  // A token in the prose that nothing declares is the failure
  // `buildLightingPrompt` throws on at run time -- caught here instead, while
  // the prose is still on screen and editable, because an unresolved
  // `{COOL_GEL}` reaching FAL renders as a plausible picture rather than an
  // error.
  const declared = new Set(object.gels.map((g) => g.token))
  const used = [...object.setup.matchAll(/\{([A-Z_]+)\}/g)].map((m) => m[1])
  const undeclared = [...new Set(used)].filter((t) => !declared.has(t))
  if (undeclared.length > 0) {
    throw new Error(
      `The setup uses ${undeclared.map((t) => `{${t}}`).join(', ')}, which it did not declare. Run it again.`,
    )
  }

  return {
    id: slugify(object.name),
    name: object.name,
    setup: object.setup.trim(),
    gels: object.gels.filter((g) => used.includes(g.token)),
  }
}
