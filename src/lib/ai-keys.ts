/**
 * Missing-provider-key signalling, shared by server and client.
 *
 * Server functions that call a text/vision model fail with an ordinary Error
 * whose message crosses the RPC boundary as a plain string — that string is all
 * the client gets. So the fact "this failed because a key is absent" is encoded
 * *into* the message with a marker, and parsed back out on the other side.
 *
 * Portable: depends on nothing but this file. Drop it into another project and
 * the pair of functions still works.
 */

export type AiProvider = 'anthropic' | 'google'

export interface MissingKeyInfo {
  provider: AiProvider
  /** The environment variable the server reads. */
  envVar: string
  /** Human-facing provider name. */
  label: string
}

const MARKER = 'MISSING_AI_KEY'

export const AI_PROVIDERS: Record<AiProvider, MissingKeyInfo> = {
  anthropic: {
    provider: 'anthropic',
    envVar: 'ANTHROPIC_API_KEY',
    label: 'Anthropic',
  },
  google: {
    provider: 'google',
    envVar: 'GOOGLE_GENERATIVE_AI_API_KEY',
    label: 'Google Gemini',
  },
}

/**
 * The message a server function throws when its provider key is absent. Written
 * so that a caller which never parses it still reads something useful in a log.
 */
export function missingKeyMessage(provider: AiProvider): string {
  const { envVar, label } = AI_PROVIDERS[provider]
  return `${MARKER}:${provider} — this action needs a ${label} API key. Set ${envVar} in .env.local and restart the dev server.`
}

/** Recover the provider from an error thrown by `missingKeyMessage`, else null. */
export function parseMissingKey(err: unknown): MissingKeyInfo | null {
  const message =
    err instanceof Error ? err.message : typeof err === 'string' ? err : ''
  if (!message.startsWith(`${MARKER}:`)) return null
  const provider = message.slice(MARKER.length + 1).split(' ')[0]
  return provider in AI_PROVIDERS ? AI_PROVIDERS[provider as AiProvider] : null
}
