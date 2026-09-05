import 'server-only'
import { fal } from '@fal-ai/client'
import { falFetch } from './fal-fetch.server'

/**
 * The configured FAL client, and the only one (#556).
 *
 * `fal.config` was called in six modules with the same credentials line copied
 * into each. That was harmless while credentials were the only setting; it
 * stopped being harmless the moment a second one mattered, because a seventh
 * call site added the credentials it could see and silently missed the
 * transport -- and the failure it produces is a generation that cannot reach
 * FAL at all, hours after the server started.
 *
 * Import `fal` from here rather than from `@fal-ai/client`. The credentials are
 * read per request, so this is safe at module scope even though `FAL_KEY` is
 * not there at build time.
 */
fal.config({
  credentials: () => process.env.FAL_KEY ?? '',
  fetch: falFetch,
})

export { fal }

/** Paid workflows checkpoint intent before this call. The SDK's queue.submit
 * retries POSTs internally; an ambiguous response must not spend twice. */
export async function submitFalOnce(
  endpoint: string,
  input: Record<string, unknown>,
) {
  if (!process.env.FAL_KEY) throw new Error('FAL_KEY is not set.')
  if (!/^[a-zA-Z0-9_/-]+$/.test(endpoint))
    throw new Error('Invalid FAL endpoint.')
  const response = await falFetch(`https://queue.fal.run/${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Key ${process.env.FAL_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(120000),
  })
  if (!response.ok)
    throw new Error(
      `FAL submission returned ${response.status}. Check the provider before starting another attempt.`,
    )
  const result = (await response.json()) as { request_id?: unknown }
  if (typeof result.request_id !== 'string' || !result.request_id)
    throw new Error('FAL did not return a request receipt.')
  return result.request_id
}
