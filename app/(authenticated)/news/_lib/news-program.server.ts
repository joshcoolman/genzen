import crypto from 'node:crypto'
import { Effect, Schedule } from 'effect'
import { z } from 'zod'
import type { NewsPost } from '#/lib/types/db'
import { IMAGE_MODELS } from '#/features/ai-images/models'
import { VIDEO_MODELS } from '#/features/video/models'
import { ResultMalformed, isRetryable } from '#/lib/effect/errors'
import { Db, Fal, Reasoning, Storage } from '#/lib/effect/services.server'
import { first, jsonb } from '#/lib/server/db.server'
import heroStyle from '#/lib/prompts/news-hero-image.md'
import heroSubjectSystem from '#/lib/prompts/news-hero-subject.md'
import researchSystem from '#/lib/prompts/news-research.md'

/**
 * The News pipeline as Effect programs, with the `'use server'` boundary next
 * door (#721).
 *
 * The split is what makes the tests beside this file possible: an action module
 * may only export async functions, so a program that is *exported as a value*
 * has to live outside one. That turns out to be the better shape anyway --
 * everything here asks the context for `Fal`, `Reasoning`, `Db` and `Storage`
 * and knows nothing about which vendor answers, so a test provides fake Layers
 * and mocks no module paths at all. The seven `vi.mock` calls at the top of
 * `generate-video.action.test.ts` are what this replaces.
 */

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

/**
 * Three attempts, 250ms then 500ms apart -- the shape `withNetworkRetry` grew
 * over #556, now stated once and gated on the tag instead of on a fresh walk
 * of the `cause` chain. `isRetryable` is exhaustive over the error family, so
 * a refusal costs one request and a dead socket costs three.
 */
const TRANSIENT = {
  while: isRetryable,
  times: 2,
  schedule: Schedule.exponential('250 millis', 2),
} as const

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

/** Generate a hero, store it, and give back the `user_images` row id. */
const heroImage = Effect.fn('news.heroImage')(function* (
  userId: string,
  subject: string,
  color: string,
) {
  const fal = yield* Fal
  const storage = yield* Storage
  const db = yield* Db

  const prompt = `${heroStyle.trim()} ${subject.trim()}, ${color} ground.`
  const url = yield* fal.image({
    endpoint: HERO_ENDPOINT,
    input: { ...HERO_INPUT, prompt },
  })
  const asset = yield* storage.store(userId, url)

  const rows = yield* db.query<{ id: string }>(
    'news.insertHeroImage',
    (c) => c`
    insert into user_images
      (user_id, title, storage_path, file_name, file_hash, file_size,
       mime_type, source, origin)
    values
      (${userId}, ${'News hero image'}, ${asset.storagePath}, ${asset.fileName},
       ${asset.fileHash}, ${asset.fileSize}, ${'image/png'}, ${'ai_generated'}, ${'images'})
    returning id
  `,
  )

  const id = first(rows)?.id
  if (!id) {
    return yield* new ResultMalformed({
      message: 'The hero image row did not come back from the insert.',
    })
  }
  return id
})

/**
 * A hero, or none, and never a failed feed.
 *
 * A picture is the one part of a post that is allowed to be missing -- the
 * writing is the post. So a refusal degrades to a placeholder rather than
 * taking the batch down with it, which is what `Promise.allSettled` plus
 * `return null` was doing. The difference is that the reason now reaches the
 * log as a `Cause` with the whole chain attached, instead of a swallowed
 * `console.error` on a value nobody kept.
 */
const heroImageOrNone = (userId: string, subject: string, color: string) =>
  heroImage(userId, subject, color).pipe(
    Effect.retry(TRANSIENT),
    Effect.tapCause((cause) =>
      Effect.sync(() => {
        console.error('[news] no hero image for this post:\n', cause)
      }),
    ),
    Effect.catch(() => Effect.succeed(null)),
  )

const listPosts = (userId: string) =>
  Effect.gen(function* () {
    const db = yield* Db
    return yield* db.query<NewsPost>(
      'news.list',
      (c) => c`
      select
        id, user_id, title, what_happened, why_interesting, the_details,
        for_genzen, hero_image_id, source_links, run_id,
        created_at::text as created_at
      from news_posts
      where user_id = ${userId}
      order by created_at desc
    `,
    )
  })

export const researchNews = (userId: string, guidance: string) =>
  Effect.gen(function* () {
    const reasoning = yield* Reasoning
    const db = yield* Db

    const userMessage = [
      buildBaseline(),
      guidance.trim() ? `Guidance from the user: ${guidance.trim()}` : null,
      `Today's date: ${new Date().toISOString().slice(0, 10)}.`,
    ]
      .filter(Boolean)
      .join('\n\n')

    const { posts } = yield* reasoning.research({
      system: researchSystem,
      prompt: userMessage,
      schema: responseSchema,
    })
    if (posts.length === 0) return []

    const runId = crypto.randomUUID()

    const inserted: Array<NewsPost> = []
    for (const post of posts) {
      const rows = yield* db.query<NewsPost>(
        'news.insertPost',
        (c) => c`
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
      const row = first(rows)
      if (row) inserted.push(row)
    }

    // The fan-out. Every hero renders at once and each one settles on its own
    // terms, which is what `Promise.allSettled` bought -- except a settled
    // rejection here is a typed failure that has already been retried, logged
    // and turned into an absent picture.
    const heroIds = yield* Effect.forEach(
      posts,
      (post, i) =>
        heroImageOrNone(
          userId,
          post.hero_subject,
          GROUND_COLORS[i % GROUND_COLORS.length],
        ),
      { concurrency: 'unbounded' },
    )

    yield* Effect.forEach(
      inserted,
      (row, i) => {
        const heroId = heroIds[i]
        if (!heroId) return Effect.void
        return db.query(
          'news.setHero',
          (c) => c`
          update news_posts
          set hero_image_id = ${heroId}
          where id = ${row.id} and user_id = ${userId}
        `,
        )
      },
      { concurrency: 'unbounded', discard: true },
    )

    return yield* listPosts(userId)
  })

/**
 * A visual subject for a post that no longer has one.
 *
 * The research model writes a `hero_subject` per post and it is used once and
 * dropped -- it is not a column, so a retry has only the row. Retrying on
 * `post.title` was the old behaviour and it is the wrong input twice over: a
 * title is a product name and a version number rather than a picture, and the
 * cheaper the renderer the less able it is to find a picture in one.
 *
 * The `Reasoning` service's cheap path instead. It is a second or so and a
 * fraction of a cent, and News already requires a reasoning key to have
 * produced a post at all, so the retry depends on nothing new. Deriving it per
 * press rather than storing it also makes the button a re-roll: a persisted
 * subject would render the same prompt for the life of the post, which is not
 * what a retry offers.
 *
 * Falls back to the title on any failure -- a worse picture beats no picture,
 * and that was the behaviour before this existed.
 */
const heroSubjectFor = Effect.fn('news.heroSubject')(function* (
  post: NewsPost,
) {
  const reasoning = yield* Reasoning
  return yield* reasoning
    .summarize({
      system: heroSubjectSystem,
      prompt: [post.title, post.what_happened, post.why_interesting].join(
        '\n\n',
      ),
    })
    .pipe(
      Effect.map((text) => text || post.title),
      Effect.tapCause((cause) =>
        Effect.sync(() => {
          console.error(
            '[news] hero subject failed, falling back to title:\n',
            cause,
          )
        }),
      ),
      Effect.catch(() => Effect.succeed(post.title)),
    )
})

export const regenHero = (userId: string, postId: string) =>
  Effect.gen(function* () {
    const db = yield* Db

    const rows = yield* db.query<NewsPost>(
      'news.get',
      (c) => c`
      select
        id, user_id, title, what_happened, why_interesting, the_details,
        for_genzen, hero_image_id, source_links, run_id,
        created_at::text as created_at
      from news_posts
      where id = ${postId} and user_id = ${userId}
    `,
    )
    const post = first(rows)
    if (!post) return null

    const color =
      GROUND_COLORS[Math.floor(Math.random() * GROUND_COLORS.length)]
    const subject = yield* heroSubjectFor(post)

    // No `catch` here, unlike the batch: a press of Retry is someone asking for
    // a picture and waiting for it, so a refusal is the answer rather than
    // something to hide behind an unchanged card.
    const heroId = yield* heroImage(userId, subject, color).pipe(
      Effect.retry(TRANSIENT),
    )

    yield* db.query(
      'news.setHero',
      (c) => c`
      update news_posts
      set hero_image_id = ${heroId}
      where id = ${postId} and user_id = ${userId}
    `,
    )
    return heroId
  })

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
 * The guard raises a *defect* rather than a member of the error family, and
 * that is the shape the distinction is for: reaching this in production is a
 * bug in the caller, not a failure the feed should be able to render.
 * `runAction` logs the `Cause` and the client is told `Unexpected` -- it never
 * learns what the guard was.
 *
 * The hero image row is left alone. It is an ordinary `user_images` row that
 * shows up in the library like any other, and `hero_image_id` is
 * `on delete set null` in the other direction -- deleting a picture because the
 * post quoting it went would be the surprising half of this.
 */
export const deletePost = (userId: string, postId: string) =>
  Effect.gen(function* () {
    if (process.env.NODE_ENV !== 'development') {
      return yield* Effect.die(
        new Error('Deleting a post is a development-only affordance.'),
      )
    }
    const db = yield* Db
    yield* db.query(
      'news.delete',
      (c) => c`
      delete from news_posts
      where id = ${postId} and user_id = ${userId}
    `,
    )
  })
