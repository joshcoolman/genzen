'use server'

import crypto from 'node:crypto'
import { anthropic } from '@ai-sdk/anthropic'
import { Output, generateText } from 'ai'
import { z } from 'zod'
import type { NewsPost } from '#/lib/types/db'
import { IMAGE_MODELS } from '#/features/ai-images/models'
import { VIDEO_MODELS } from '#/features/video/models'
import { fal } from '#/lib/server/fal-client.server'
import { downloadAndStoreImage } from '#/lib/server/image-storage.server'
import { ai, requireAiRole } from '#/lib/server/ai.server'
import { resolveAuth } from '#/lib/server/auth.server'
import { first, jsonb, sql } from '#/lib/server/db.server'
import heroStyle from '#/lib/prompts/news-hero-image.md'
import heroSubjectSystem from '#/lib/prompts/news-hero-subject.md'
import researchSystem from '#/lib/prompts/news-research.md'

/**
 * The two ways a hero image gets made.
 *
 * `full` is the first pass, where a batch of images is generated once and read
 * for a long time. `fast` is the retry, where someone is sitting on the card
 * waiting -- Flare at `quality: 'high'` is a ~140-second render, which is the
 * exact default that took GPT Image 2 out of the lineup in #389, and nobody
 * waits that long to re-roll a picture they already called good enough.
 *
 * Klein rather than Z-Image Turbo, which is faster still: Turbo takes no
 * negative prompt at all (see `guide-z-image-turbo.md`) and `news-hero-image.md`
 * ends in two negations, so Turbo would need its own style brief and retried
 * cards would stop matching the originals. Klein reads the brief as written.
 *
 * Neither sets `output_format`, so both return png and the `image/png` the
 * insert below records stays true.
 */
const HERO_RENDERERS = {
  full: {
    endpoint: 'openai/gpt-image-2.5/flare/text-to-image',
    input: { image_size: 'landscape_16_9', quality: 'high' },
  },
  fast: {
    endpoint: 'fal-ai/flux-2/klein/4b',
    input: { image_size: 'landscape_16_9' },
  },
} as const
const GROUND_COLORS = ['mustard', 'navy', 'sage', 'coral', 'plum', 'cream']

const postSchema = z.object({
  title: z.string(),
  what_happened: z.string(),
  why_interesting: z.string(),
  the_details: z.string(),
  for_genzen: z.string(),
  source_links: z.array(z.string()),
  hero_subject: z.string(),
})

const responseSchema = z.object({
  posts: z.array(postSchema),
})

function buildBaseline(): string {
  const images = IMAGE_MODELS.map((m) => m.name).join(', ')
  const videos = VIDEO_MODELS.map((m) => m.label).join(', ')
  return [
    'Image models genzen already wires: ' + images + '.',
    'Video models genzen already wires: ' + videos + '.',
  ].join('\n')
}

async function generateHeroImage(
  userId: string,
  subject: string,
  color: string,
  renderer: keyof typeof HERO_RENDERERS = 'full',
): Promise<string | null> {
  if (!process.env.FAL_KEY) return null
  try {
    const { endpoint, input } = HERO_RENDERERS[renderer]
    const prompt = `${heroStyle.trim()} ${subject.trim()}, ${color} ground.`
    const { data } = await fal.subscribe(endpoint, {
      input: { ...input, prompt },
    })

    const images = (data as { images?: Array<{ url?: string }> }).images
    const url = images?.[0]?.url
    if (!url) return null

    const { storagePath, fileName, fileHash, fileSize } =
      await downloadAndStoreImage(userId, url)

    const rows = await sql<Array<{ id: string }>>`
      insert into user_images
        (user_id, title, storage_path, file_name, file_hash, file_size,
         mime_type, source, origin)
      values
        (${userId}, ${'News hero image'}, ${storagePath}, ${fileName},
         ${fileHash}, ${fileSize}, ${'image/png'}, ${'ai_generated'}, ${'images'})
      returning id
    `
    return first(rows)?.id ?? null
  } catch (err) {
    console.error('[news] hero image generation failed:', err)
    return null
  }
}

export async function getNews(guidance: string): Promise<Array<NewsPost>> {
  requireAiRole('reasoning')
  const { userId } = await resolveAuth()

  const baseline = buildBaseline()
  const userMessage = [
    baseline,
    guidance.trim() ? `Guidance from the user: ${guidance.trim()}` : null,
    `Today's date: ${new Date().toISOString().slice(0, 10)}.`,
  ]
    .filter(Boolean)
    .join('\n\n')

  const { output } = await generateText({
    model: ai.reasoning,
    system: researchSystem,
    tools: {
      web_search: anthropic.tools.webSearch_20250305({ maxUses: 8 }),
    },
    output: Output.object({ schema: responseSchema }),
    messages: [{ role: 'user', content: userMessage }],
  })

  const { posts } = output
  if (posts.length === 0) return []

  const runId = crypto.randomUUID()

  const inserted: Array<NewsPost> = []
  for (const post of posts) {
    const row = first(
      await sql<Array<NewsPost>>`
        insert into news_posts
          (user_id, title, what_happened, why_interesting, the_details,
           for_genzen, source_links, run_id)
        values
          (${userId}, ${post.title}, ${post.what_happened}, ${post.why_interesting},
           ${post.the_details}, ${post.for_genzen}, ${jsonb(post.source_links)}, ${runId})
        returning
          id, user_id, title, what_happened, why_interesting, the_details,
          for_genzen, hero_image_id, source_links, run_id,
          created_at::text as created_at
      `,
    )
    if (row) inserted.push(row)
  }

  const heroResults = await Promise.allSettled(
    posts.map((p, i) =>
      generateHeroImage(
        userId,
        p.hero_subject,
        GROUND_COLORS[i % GROUND_COLORS.length],
      ),
    ),
  )

  await Promise.all(
    inserted.map((row, i) => {
      const r = heroResults[i]
      const heroId = r.status === 'fulfilled' ? r.value : null
      if (!heroId) return Promise.resolve()
      return sql`
        update news_posts
        set hero_image_id = ${heroId}
        where id = ${row.id} and user_id = ${userId}
      `
    }),
  )

  return listNewsPosts()
}

export async function listNewsPosts(): Promise<Array<NewsPost>> {
  const { userId } = await resolveAuth()
  return sql<Array<NewsPost>>`
    select
      id, user_id, title, what_happened, why_interesting, the_details,
      for_genzen, hero_image_id, source_links, run_id,
      created_at::text as created_at
    from news_posts
    where user_id = ${userId}
    order by created_at desc
  `
}

export async function getNewsPost(id: string): Promise<NewsPost | null> {
  const { userId } = await resolveAuth()
  const rows = await sql<Array<NewsPost>>`
    select
      id, user_id, title, what_happened, why_interesting, the_details,
      for_genzen, hero_image_id, source_links, run_id,
      created_at::text as created_at
    from news_posts
    where id = ${id} and user_id = ${userId}
  `
  return first(rows) ?? null
}

/**
 * A visual subject for a post that no longer has one.
 *
 * The research model writes a `hero_subject` per post and it is used once and
 * dropped -- it is not a column, so a retry has only the row. Retrying on
 * `post.title` was the old behaviour and it is the wrong input twice over: a
 * title is a product name and a version number rather than a picture, and the
 * cheaper the renderer the less able it is to find a picture in one.
 *
 * Haiku on the body instead. It is a second or so and a fraction of a cent,
 * and News already requires an Anthropic key to have produced a post at all,
 * so the retry depends on nothing new. Deriving it per press rather than
 * storing it also makes the button a re-roll: a persisted subject would render
 * the same prompt for the life of the post, which is not what a retry offers.
 *
 * Falls back to the title on any failure -- a worse picture beats no picture,
 * and that was the behaviour before this existed.
 */
async function heroSubjectFor(post: NewsPost): Promise<string> {
  try {
    requireAiRole('fast')
    const { text } = await generateText({
      model: ai.fast,
      system: heroSubjectSystem,
      messages: [
        {
          role: 'user',
          content: [post.title, post.what_happened, post.why_interesting].join(
            '\n\n',
          ),
        },
      ],
    })
    return text.trim() || post.title
  } catch (err) {
    console.error('[news] hero subject failed, falling back to title:', err)
    return post.title
  }
}

export async function regenHeroImage(postId: string): Promise<string | null> {
  const { userId } = await resolveAuth()

  const post = await getNewsPost(postId)
  if (!post) return null

  const colorIndex = Math.floor(Math.random() * GROUND_COLORS.length)
  const color = GROUND_COLORS[colorIndex]

  const subject = await heroSubjectFor(post)
  const heroId = await generateHeroImage(userId, subject, color, 'fast')
  if (!heroId) return null

  await sql`
    update news_posts
    set hero_image_id = ${heroId}
    where id = ${postId} and user_id = ${userId}
  `
  return heroId
}
