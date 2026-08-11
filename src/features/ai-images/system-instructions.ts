/**
 * System instructions: one block of text prepended to every image prompt (#272).
 *
 * Deliberately not a prompt. It is entered once, behind a gear, and applies to
 * every prompt in a run -- the alternative was pasting the same paragraph into
 * sixteen textareas, which in practice meant it never got done.
 *
 * One global value, one key, shared by both Images and Canvas. Route-scoping is
 * not a feature: once #264 makes blocks named and loadable, a route does not own
 * a system prompt, it has one currently loaded.
 *
 * Stored raw (what was typed) and trimmed only when composing the prefix, so
 * typing a trailing newline does not fight the persisted value.
 */

export const SYSTEM_INSTRUCTIONS_KEY = 'genzen:system-instructions'

export function readSystemInstructions(): string {
  try {
    return localStorage.getItem(SYSTEM_INSTRUCTIONS_KEY) ?? ''
  } catch {
    return ''
  }
}

export function writeSystemInstructions(value: string): void {
  try {
    if (value.trim()) {
      localStorage.setItem(SYSTEM_INSTRUCTIONS_KEY, value)
    } else {
      // An emptied box leaves nothing behind, so "is anything set" is a
      // question about the key existing rather than about whitespace.
      localStorage.removeItem(SYSTEM_INSTRUCTIONS_KEY)
    }
  } catch {
    // ignore
  }
}

/** The instructions plus their separator, or '' when there are none. */
export function systemInstructionsPrefix(): string {
  const value = readSystemInstructions().trim()
  return value ? `${value}\n\n` : ''
}
