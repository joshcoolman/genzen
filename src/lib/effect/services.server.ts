import 'server-only'
import { anthropic } from '@ai-sdk/anthropic'
import { Output, generateText } from 'ai'
import { Context, Effect, Layer } from 'effect'
import { decodeFalError } from './decode-fal.server'
import {
  AiDecode,
  AiKeyMissing,
  DbError,
  ResultMalformed,
  StorageFailed,
} from './errors'
import type { z } from 'zod'
import type { FalFailure } from './decode-fal.server'
import { AI_PROVIDERS } from '#/lib/ai-keys'
import { ai } from '#/lib/server/ai.server'
import { sql } from '#/lib/server/db.server'
import { fal } from '#/lib/server/fal-client.server'
import { downloadAndStoreImage } from '#/lib/server/image-storage.server'

/**
 * The four services News runs on, named for the job rather than the vendor.
 *
 * That naming is the point of the exercise: `Reasoning` is a model that thinks
 * and can search, and Anthropic is one Layer that provides it. Swapping in
 * Google or OpenAI to see what the difference feels like is a second Layer and
 * one line where the runtime is assembled -- nothing in the News program says
 * "anthropic", and nothing in a test mocks a module path.
 *
 * Every vendor knob stays inside the Layer that needs it. `web_search` is an
 * Anthropic tool definition and lives in `Reasoning.layerAnthropic`; a Google
 * layer would wire its own grounding there and the caller would not change.
 */

// -- Fal --------------------------------------------------------------------

export interface FalImageRequest {
  readonly endpoint: string
  readonly input: Record<string, unknown>
}

export class Fal extends Context.Service<
  Fal,
  {
    /** The URL of the first image an endpoint produced. */
    readonly image: (
      request: FalImageRequest,
    ) => Effect.Effect<string, FalFailure | ResultMalformed | AiKeyMissing>
  }
>()('genzen/Fal') {
  static readonly layer = Layer.succeed(Fal, {
    image: Effect.fn('Fal.image')(function* (request: FalImageRequest) {
      if (!process.env.FAL_KEY) {
        return yield* new AiKeyMissing({
          provider: 'fal',
          envVar: 'FAL_KEY',
          message:
            'Generating a picture needs a FAL API key. Set FAL_KEY in .env.local and restart the dev server.',
        })
      }

      const { data } = yield* Effect.tryPromise({
        try: () => fal.subscribe(request.endpoint, { input: request.input }),
        catch: decodeFalError,
      })

      const url = (data as { images?: Array<{ url?: string }> }).images?.[0]
        ?.url
      if (!url) {
        return yield* new ResultMalformed({
          message: `${request.endpoint} returned no image URL.`,
        })
      }
      return url
    }),
  })
}

// -- Reasoning --------------------------------------------------------------

export interface ReasoningRequest {
  readonly system: string
  readonly prompt: string
}

export class Reasoning extends Context.Service<
  Reasoning,
  {
    /** A structured answer from a model allowed to look things up. */
    readonly research: <T>(
      request: ReasoningRequest & { readonly schema: z.ZodType<T> },
    ) => Effect.Effect<T, AiKeyMissing | AiDecode>
    /** A sentence or two from the cheapest model that can write one. */
    readonly summarize: (
      request: ReasoningRequest,
    ) => Effect.Effect<string, AiKeyMissing | AiDecode>
  }
>()('genzen/Reasoning') {
  /**
   * Anthropic, with its own knobs: `webSearch` for research, Haiku for the
   * short one. The key check is here rather than at each call site because
   * "which variable does this need" is a property of the provider.
   */
  static readonly layerAnthropic = Layer.succeed(Reasoning, {
    research: Effect.fn('Reasoning.research')(function* <T>(
      request: ReasoningRequest & { schema: z.ZodType<T> },
    ) {
      yield* requireAnthropicKey
      const { output } = yield* Effect.tryPromise({
        try: () =>
          generateText({
            model: ai.reasoning,
            system: request.system,
            tools: {
              web_search: anthropic.tools.webSearch_20250305({ maxUses: 8 }),
            },
            output: Output.object({ schema: request.schema }),
            messages: [{ role: 'user', content: request.prompt }],
          }),
        catch: (err) => new AiDecode({ message: describe(err) }),
      })
      return output
    }),

    summarize: Effect.fn('Reasoning.summarize')(function* (
      request: ReasoningRequest,
    ) {
      yield* requireAnthropicKey
      const { text } = yield* Effect.tryPromise({
        try: () =>
          generateText({
            model: ai.fast,
            system: request.system,
            messages: [{ role: 'user', content: request.prompt }],
          }),
        catch: (err) => new AiDecode({ message: describe(err) }),
      })
      return text.trim()
    }),
  })
}

const requireAnthropicKey = Effect.suspend(() => {
  const { envVar, label, provider } = AI_PROVIDERS.anthropic
  return process.env[envVar]
    ? Effect.void
    : new AiKeyMissing({
        provider,
        envVar,
        message: `This action needs a ${label} API key. Set ${envVar} in .env.local and restart the dev server.`,
      })
})

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

// -- Db ---------------------------------------------------------------------

export class Db extends Context.Service<
  Db,
  {
    /**
     * Run one statement. The callback gets the client, so the query stays at
     * the call site where `eslint-rules/sql-user-scoping.js` can see its
     * `user_id` filter -- a `Db` that took query strings would hide every one
     * of them from the only check that catches a missing scope.
     *
     * `label` is the span name and the fake's lookup key, which is why tests
     * can answer a program's queries without a database.
     */
    readonly query: <T>(
      label: string,
      run: (client: typeof sql) => PromiseLike<Array<T>>,
    ) => Effect.Effect<Array<T>, DbError>
  }
>()('genzen/Db') {
  static readonly layer = Layer.succeed(Db, {
    query: Effect.fn('Db.query')(function* <T>(
      label: string,
      run: (client: typeof sql) => PromiseLike<Array<T>>,
    ) {
      return yield* Effect.tryPromise({
        try: () => Promise.resolve(run(sql)),
        catch: (err) => new DbError({ label, message: describe(err) }),
      })
    }),
  })
}

// -- Storage ----------------------------------------------------------------

export interface StoredImage {
  readonly storagePath: string
  readonly fileName: string
  readonly fileHash: string
  readonly fileSize: number
}

export class Storage extends Context.Service<
  Storage,
  {
    /** Pull a provider's output into our own bucket (#305). */
    readonly store: (
      userId: string,
      url: string,
    ) => Effect.Effect<StoredImage, StorageFailed>
  }
>()('genzen/Storage') {
  static readonly layer = Layer.succeed(Storage, {
    store: Effect.fn('Storage.store')(function* (userId: string, url: string) {
      return yield* Effect.tryPromise({
        try: () => downloadAndStoreImage(userId, url),
        catch: (err) => new StorageFailed({ message: describe(err) }),
      })
    }),
  })
}

/** Everything a program run through `runAction` may ask for. */
export type AppServices = Fal | Reasoning | Db | Storage

export const AppLayer = Layer.mergeAll(
  Fal.layer,
  Reasoning.layerAnthropic,
  Db.layer,
  Storage.layer,
)
