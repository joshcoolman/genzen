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
 * The one endpoint that makes a hero image, for every path that makes one:
 * the first pass, Retry, and New thumbnail.
 *
 * `quality: 'high'` is a ~140-second render and that is a deliberate trade, not
 * an oversight -- the Flare entry in IMAGE_MODELS pins `low` for interactive
 * generation, and #389 took GPT Image 2 out of the lineup over exactly this
 * default. A branch moved the two interactive paths to FLUX.2 Klein 4B for a
 * few-second render and the output was visibly worse against the originals, so
 * it went. The feed is read for a long time and generated rarely; one endpoint
 * at one quality also means a replaced thumbnail matches the ones beside it,
 * which is the whole reason to have a wall of them.
 */
const HERO_ENDPOINT = 'openai/gpt-image-2.5/flare/text-to-image'
const HERO_INPUT = { image_size: 'landscape_16_9', quality: 'high' } as const
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
): Promise<string | null> {
  if (!process.env.FAL_KEY) return null
  try {
    const prompt = `${heroStyle.trim()} ${subject.trim()}, ${color} ground.`
    const { data } = await fal.subscribe(HERO_ENDPOINT, {
      input: { ...HERO_INPUT, prompt },
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
  const heroId = await generateHeroImage(userId, subject, color)
  if (!heroId) return null

  await sql`
    update news_posts
    set hero_image_id = ${heroId}
    where id = ${postId} and user_id = ${userId}
  `
  return heroId
}

/**
 * Remove one post from the feed. Development only, on purpose.
 *
 * It is a curation affordance, not a feature: the feed is generated in batches
 * and a batch usually carries one story that is off-topic or duplicated, and
 * the cheapest fix while building is to drop it. A deployed reader has no such
 * job -- the feed is something to read, and a destructive verb on a card
 * nobody curates is only a way to lose a post by mis-click.
 *
 * Guarded here as well as hidden in the UI, because hiding a control is not
 * access control -- the action is reachable by anyone who can form a request
 * (the same reasoning as `grabYouTubeFrame`).
 *
 * The hero image row is left alone. It is an ordinary `user_images` row that
 * shows up in the library like any other, and `hero_image_id` is
 * `on delete set null` in the other direction -- deleting a picture because the
 * post quoting it went would be the surprising half of this.
 */
export async function deleteNewsPost(postId: string): Promise<void> {
  const { userId } = await resolveAuth()

  if (process.env.NODE_ENV !== 'development') {
    throw new Error('Deleting a post is a development-only affordance.')
  }

  await sql`
    delete from news_posts
    where id = ${postId} and user_id = ${userId}
  `
}
