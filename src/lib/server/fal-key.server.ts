/**
 * The one FAL_KEY precondition, and the one message for failing it.
 *
 * The message names the shell as a suspect on purpose. "Add it to .env.local"
 * alone is actively misleading: the most common way to get here is an
 * `export FAL_KEY=""` left in a dotfile, which wins over .env.local because
 * every dotenv loader skips a name already present in the environment. The
 * error then points at the file, the reader re-pastes a key that was already
 * correct, restarts, and hits the identical wall (Aug 2026).
 *
 * `pnpm dev` warns about this at startup -- see scripts/check-env-shadow.mjs --
 * but the banner scrolls away and this error is what survives in the UI.
 */
export function assertFalKey(): void {
  if (process.env.FAL_KEY) return
  throw new Error(
    'FAL_KEY is not set. Check .env.local, or try `unset FAL_KEY` and restart ' +
      'the dev server.',
  )
}
