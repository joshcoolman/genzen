/**
 * Enhanced prompt text -> the text the user actually typed before the enhancer
 * replaced it (#210).
 *
 * Keyed by the enhanced string rather than by prompt index so it
 * self-invalidates: edit the text and the key stops matching, so a stale
 * original is never attributed to a generation that no longer descends from it.
 */
export type PromptOrigins = Record<string, string>

/**
 * Add one enhance pair, resolving through the map so a second enhance of an
 * already-enhanced prompt still records the *typed* text rather than the
 * previous machine-written pass. Returns a new map, capped to `max` entries
 * (newest kept) -- only pairs still sitting in the textarea can ever be read.
 */
export function recordPromptOrigin(
  origins: PromptOrigins,
  enhanced: string,
  previous: string,
  max: number,
): PromptOrigins {
  const key = enhanced.trim()
  const from = previous.trim()
  const original = origins[from] ?? from
  if (!key || !original || key === original) return origins
  const entries = Object.entries({ ...origins, [key]: original }).slice(-max)
  return Object.fromEntries(entries)
}
