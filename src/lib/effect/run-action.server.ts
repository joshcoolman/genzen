import 'server-only'
import { Cause, Exit, ManagedRuntime, Option } from 'effect'
import { AppLayer } from './services.server'
import { toWire } from './errors'
import type { AppServices } from './services.server'
import type { GenzenError } from './errors'
import type { Effect } from 'effect'
import type { ActionResult } from './result'

/**
 * The one place an Effect program becomes a server action's return value.
 *
 * Two things cross this boundary and nothing else. An expected failure -- a
 * member of the family -- crosses as plain tagged data the client can match
 * on. A defect is never described to the client at all: it is logged here as a
 * `Cause`, with the fibre trace and the chain of `cause`s intact, and the
 * caller sees `Unexpected`. That asymmetry is the point. The old code threw
 * `new Error(string)` for both, which is why a dead HTTP/2 session reached the
 * UI as "fetch failed" and told nobody anything (#556).
 *
 * The runtime is built once and cached on `globalThis`, for the same reason
 * the Postgres pool is: every HMR re-evaluation of this module would otherwise
 * build a fresh one and strand the old one's finalizers.
 */
const globalForRuntime = globalThis as typeof globalThis & {
  __genzenEffectRuntime?: ManagedRuntime.ManagedRuntime<AppServices, never>
}

const runtime = (globalForRuntime.__genzenEffectRuntime ??=
  ManagedRuntime.make(AppLayer))

export async function runAction<T>(
  program: Effect.Effect<T, GenzenError, AppServices>,
): Promise<ActionResult<T>> {
  const exit = await runtime.runPromiseExit(program)

  if (Exit.isSuccess(exit)) return { ok: true, value: exit.value }

  const failure = Cause.findErrorOption(exit.cause)
  if (Option.isSome(failure)) {
    console.error(Cause.pretty(exit.cause))
    return { ok: false, error: toWire(failure.value) }
  }

  console.error('[effect] defect:', Cause.pretty(exit.cause))
  return {
    ok: false,
    error: {
      _tag: 'Unexpected',
      message: 'Something went wrong. The server log has the details.',
      retryable: false,
    },
  }
}
