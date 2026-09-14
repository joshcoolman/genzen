'use client'

/**
 * The run you last had on screen, kept across navigation (#659).
 *
 * **The second deliberate exception to the lab's "results are lost on
 * navigation" rule**, and it earns it the same way `enhance/last-run.ts` does:
 * one record, overwritten by the next change and emptied by Clear, so it is
 * either entirely there or entirely gone. The rule is against a half-persisted
 * history you cannot trust, not against a page remembering the one thing it
 * had.
 *
 * **Ids, not rows.** A clip's own record is in the library and that is where it
 * should be read from -- a run holding copies would show the name a clip had
 * when you added it, and naming clips is half of what the run is for now
 * (#657). It also means a clip trashed from Video simply drops out of the run
 * rather than sitting in it pointing at nothing.
 *
 * No migration and no server: the arrangement is not a fact about anything, it
 * is what this tab was doing. `localStorage` is the honest home for that, and
 * `a lab page adds no migrations` still holds.
 */

const KEY = 'genzen:lab:sequence:last-run'

export function writeRunIds(ids: Array<string>): void {
  try {
    if (ids.length === 0) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, JSON.stringify(ids))
  } catch {
    // A full or blocked store loses the arrangement, which costs a re-pick and
    // nothing else. Nothing here is unrecoverable.
  }
}

/** The stored run's clip ids, in order. Empty when there is none. */
export function readRunIds(): Array<string> {
  let raw: string | null
  try {
    raw = localStorage.getItem(KEY)
  } catch {
    return []
  }
  if (!raw) return []

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id): id is string => typeof id === 'string')
  } catch {
    return []
  }
}
