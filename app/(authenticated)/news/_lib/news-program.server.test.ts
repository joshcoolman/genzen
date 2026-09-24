import { Effect, Layer } from 'effect'
import { beforeEach, describe, expect, it } from 'vitest'
import { regenHero, researchNews } from './news-program.server'
import { ContentRefused, FalTransport } from '#/lib/effect/errors'
import { Db, Fal, Reasoning, Storage } from '#/lib/effect/services.server'

/**
 * No `vi.mock`. That is the thing being demonstrated (#721).
 *
 * Every test here provides real `Layer`s that happen to be fake, so the program
 * under test is the program that ships -- same generator, same retry policy,
 * same error family. The previous way to test this pipeline was seven
 * `vi.mock` calls naming module paths, which pass whether or not the code
 * still imports those paths and say nothing about what the program does with a
 * refusal.
 */

const USER = '00000000-0000-4000-8000-000000000001'

const post = (title: string) => ({
  title,
  what_happened: 'a thing happened',
  why_interesting: 'it matters',
  the_details: 'details',
  for_genzen: 'relevant',
  source_links: ['https://example.com'],
  hero_subject: `a picture of ${title}`,
})

const row = (id: string) => ({
  id,
  user_id: USER,
  title: id,
  what_happened: '',
  why_interesting: '',
  the_details: '',
  for_genzen: '',
  hero_image_id: null,
  source_links: [],
  run_id: 'run-1',
  created_at: '2026-09-24T00:00:00.000Z',
})

/** A Db that answers by label. The label is the only thing a program tells it,
 *  which is exactly why `Db.query` takes one. */
const queries: Array<string> = []
const answers = new Map<string, Array<unknown>>()

const TestDb = Layer.succeed(Db, {
  query: <T>(label: string) => {
    queries.push(label)
    return Effect.succeed((answers.get(label) ?? []) as Array<T>)
  },
})

const TestStorage = Layer.succeed(Storage, {
  store: () =>
    Effect.succeed({
      storagePath: `${USER}/hero.png`,
      fileName: 'hero.png',
      fileHash: 'hash',
      fileSize: 1,
    }),
})

const reasoningThatReturns = (posts: Array<ReturnType<typeof post>>) =>
  Layer.succeed(Reasoning, {
    research: <T>() => Effect.succeed({ posts } as T),
    summarize: () => Effect.succeed('a re-rolled subject'),
  })

/** Counts attempts, so a test can say how many paid requests a failure cost. */
function falThatFails(
  error: () => FalTransport | ContentRefused,
  succeedOn = 0,
) {
  const attempts = { count: 0 }
  const layer = Layer.succeed(Fal, {
    image: () =>
      Effect.suspend(() => {
        attempts.count += 1
        return attempts.count === succeedOn
          ? Effect.succeed('https://fal.example/hero.png')
          : Effect.fail(error())
      }),
  })
  return { layer, attempts }
}

const FalOk = Layer.succeed(Fal, {
  image: () => Effect.succeed('https://fal.example/hero.png'),
})

const run = <T, TError>(
  program: Effect.Effect<T, TError, Db | Fal | Reasoning | Storage>,
  layers: Layer.Layer<Db | Fal | Reasoning | Storage>,
) => Effect.runPromise(Effect.provide(program, layers))

beforeEach(() => {
  queries.length = 0
  answers.clear()
  answers.set('news.insertPost', [row('post-1')])
  answers.set('news.insertHeroImage', [{ id: 'image-1' }])
  answers.set('news.list', [row('post-1')])
})

describe('researchNews', () => {
  it('writes a post, stores its hero and points the row at it', async () => {
    const posts = await run(
      researchNews(USER, ''),
      Layer.mergeAll(
        TestDb,
        TestStorage,
        FalOk,
        reasoningThatReturns([post('Flux 3')]),
      ),
    )

    expect(queries).toEqual([
      'news.insertPost',
      'news.insertHeroImage',
      'news.setHero',
      'news.list',
    ])
    expect(posts).toHaveLength(1)
  })

  it('returns nothing to write when the model found nothing', async () => {
    const posts = await run(
      researchNews(USER, ''),
      Layer.mergeAll(TestDb, TestStorage, FalOk, reasoningThatReturns([])),
    )

    expect(posts).toEqual([])
    expect(queries).toEqual([])
  })

  // The behaviour the old `Promise.allSettled` + `return null` bought, kept --
  // but now the reason is a typed failure that reached the log as a Cause.
  it('leaves a post without a hero when the picture is refused, and still returns the feed', async () => {
    const { layer, attempts } = falThatFails(
      () => new ContentRefused({ message: 'no' }),
    )

    const posts = await run(
      researchNews(USER, ''),
      Layer.mergeAll(
        TestDb,
        TestStorage,
        layer,
        reasoningThatReturns([post('Flux 3')]),
      ),
    )

    expect(posts).toHaveLength(1)
    expect(queries).not.toContain('news.setHero')
    // A refusal is the same answer every time, so it costs exactly one request.
    expect(attempts.count).toBe(1)
  })

  it('retries a dead transport and keeps the hero it eventually gets', async () => {
    const { layer, attempts } = falThatFails(
      () => new FalTransport({ message: 'socket hang up', code: 'ECONNRESET' }),
      2,
    )

    await run(
      researchNews(USER, ''),
      Layer.mergeAll(
        TestDb,
        TestStorage,
        layer,
        reasoningThatReturns([post('Flux 3')]),
      ),
    )

    expect(attempts.count).toBe(2)
    expect(queries).toContain('news.setHero')
  })

  it('gives up after three attempts at a transport that never comes back', async () => {
    const { layer, attempts } = falThatFails(
      () => new FalTransport({ message: 'socket hang up', code: 'ECONNRESET' }),
    )

    const posts = await run(
      researchNews(USER, ''),
      Layer.mergeAll(
        TestDb,
        TestStorage,
        layer,
        reasoningThatReturns([post('Flux 3')]),
      ),
    )

    expect(attempts.count).toBe(3)
    expect(posts).toHaveLength(1)
  })
})

describe('regenHero', () => {
  // Unlike the batch, a press of Retry is someone waiting for a picture, so a
  // refusal has to reach them rather than leave the card silently unchanged.
  it('fails with the refusal rather than swallowing it', async () => {
    answers.set('news.get', [row('post-1')])
    const { layer } = falThatFails(() => new ContentRefused({ message: 'no' }))

    const exit = await Effect.runPromiseExit(
      Effect.provide(
        regenHero(USER, 'post-1'),
        Layer.mergeAll(TestDb, TestStorage, layer, reasoningThatReturns([])),
      ),
    )

    expect(exit._tag).toBe('Failure')
  })

  it("answers null for a post that is not this user's", async () => {
    answers.set('news.get', [])

    const heroId = await run(
      regenHero(USER, 'post-1'),
      Layer.mergeAll(TestDb, TestStorage, FalOk, reasoningThatReturns([])),
    )

    expect(heroId).toBeNull()
  })
})
