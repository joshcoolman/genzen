/**
 * Where a chat clip's prompt stops being setup and starts being speech.
 *
 * `composeClipPrompt` ends every clip prompt with this marker and the line in
 * quotes, so it is a fact about how the prompt was built rather than a guess at
 * its wording. Both spellings: "in English" was added to the front of the
 * prompt and beside the line in #688, and every clip made before that carries
 * the shorter one.
 */
const SPOKEN = /Speaking to camera(?:, in English)?:\s*"([\s\S]*)"\s*$/

/**
 * The line a chat clip says, read back out of the prompt it was generated from.
 *
 * **One reader, and it lives here rather than beside either caller.** The
 * Script tab reads these prompts to show the dialogue and Rerun reads them to
 * time a re-roll (#692), and a second copy of the regex is how one of them
 * quietly stops handling a spelling the other does. That is not hypothetical:
 * #703 was a duplicated list of the rows the board owns, and the copies had
 * already drifted by the time anyone looked. A pure module because `script.ts`
 * is client-importable and `director-chat.server.ts` is server-only, so neither
 * can hold something the other imports.
 *
 * `null` means the prompt has no spoken segment at all -- a silent burst, or a
 * clip from before the anchors moved into code -- and is not the same answer as
 * an empty line, which callers distinguish.
 */
export function spokenFromClipPrompt(prompt: string): string | null {
  return SPOKEN.exec(prompt.trim())?.[1] ?? null
}
