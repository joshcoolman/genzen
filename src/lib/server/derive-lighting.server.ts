import 'server-only'
import { generateObject } from 'ai'
import { z } from 'zod'
import derivePrompt from '#/lib/prompts/lighting/derive.md'
import { ai, requireAiRole } from '#/lib/server/ai.server'
import { first, sql } from '#/lib/server/db.server'
import { loadVisionImage } from '#/lib/server/vision-image.server'

/**
 * A reference photograph in, a lighting setup out.
 *
 * Written for the lab's authoring page (#562), where the output is pasted into
 * `src/lib/prompts/lighting/` unchanged -- same bullets, same `{TOKEN}` gels,
 * same prohibition on naming anything in the picture. The rules are in
 * `derive.md`; the reasons behind each are in `lighting/index.ts`, which
 * learned them the expensive way. It moved here from the lab when a staged
 * reference in the Lighting role (#635) wanted the same reading, and the app
 * may not import from `lab/`.
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

export interface DerivedLighting {
  name: string
  setup: string
  gels: Array<{ token: string; color: string }>
}

export async function deriveLightingSetup(
  userId: string,
  imageId: string,
): Promise<DerivedLighting> {
  requireAiRole('vision')

  if (!/^[0-9a-f-]{36}$/i.test(imageId)) throw new Error('Invalid imageId')

  const row = first(
    await sql<Array<{ storage_path: string | null }>>`
      select storage_path from user_images
      where id = ${imageId} and user_id = ${userId}
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
    name: object.name,
    setup: object.setup.trim(),
    gels: object.gels.filter((g) => used.includes(g.token)),
  }
}

/**
 * The setup with its gels filled in: the prose a prompt can carry. The
 * `{TOKEN}` seam exists for the lab, where a colour is a dial; a reference
 * read for its lighting has the colours it has.
 */
export function fillGels(setup: string, gels: DerivedLighting['gels']) {
  const colours = new Map(gels.map((g) => [g.token, g.color]))
  return setup.replace(
    /\{([A-Z_]+)\}/g,
    (match, token: string) => colours.get(token) ?? match,
  )
}
