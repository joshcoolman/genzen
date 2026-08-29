'use client'

/**
 * The last enhance run, kept across navigation (#465).
 *
 * **A deliberate exception to the lab's "results are lost on navigation"
 * rule.** That rule exists because something half-persisted is worse than
 * something honestly temporary — a history you cannot trust is a history you
 * re-read wrongly. This is not a history: it is **one record, overwritten by
 * the next run and emptied only by Clear**, which is the same shape as
 * `src/lib/panel-handoff.ts` and has the same property of being either entirely
 * there or entirely gone.
 *
 * It is here rather than in `src/lib/` because one page reads it and one page
 * writes it. `panel-handoff` sits in `src/lib/` because it is a door two routes
 * hold opposite ends of; a module only this folder touches belongs in this
 * folder, so deleting the folder deletes it.
 *
 * Unlike the handoff it is **read without clearing**: coming back to the page
 * is exactly the case it exists for, so a read that consumed it would lose the
 * run on the first visit back.
 */

const KEY = 'genzen:lab:enhance:last-run'

export interface EnhanceCard {
  /** The picker id the run was fired with — an endpoint, as selections are. */
  modelId: string
  modelName: string
  /**
   * The file that actually steered this card: the model's own guide, or the
   * shared instruction where it has none. Always a real path, because the
   * point of the lab is opening the file that produced what you are reading —
   * and a card that named a guide it did not use would send you to edit the
   * wrong one.
   */
  guideFile: string
  status: 'pending' | 'done' | 'error'
  output: string
  error: string | null
}

export interface EnhanceRun {
  /** What was asked, kept beside the results: the box above is editable, so by
   *  the time you read a card it may no longer hold the prompt that made it. */
  prompt: string
  /** The steering in force when this ran, if any. Kept for the same reason as
   *  the prompt — it is half of what produced these cards, and a grid you
   *  cannot attribute is not evidence. */
  steering: string
  /**
   * The clip spec this ran at, on a multi-shot run only.
   *
   * Kept for the same reason as the prompt and the steering: they are part of
   * what produced these cards, and a script read back without the length it
   * was timed to cannot be checked against anything. Absent on an image run
   * and on runs written before #522.
   */
  duration?: number
  aspectRatio?: string
  cards: Array<EnhanceCard>
}

export function writeLastRun(run: EnhanceRun | null): void {
  try {
    if (run === null) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, JSON.stringify(run))
  } catch {
    // A full or blocked store loses the run, which is the honest failure: the
    // prompt is still in the box and re-running costs Claude cents.
  }
}

/** The stored run, or null when there is none. Leaves it in place. */
export function readLastRun(): EnhanceRun | null {
  let raw: string | null
  try {
    raw = localStorage.getItem(KEY)
  } catch {
    return null
  }
  if (!raw) return null

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    // Runs written before steering existed carry no such field; an absent
    // steer and an empty one are the same thing.
    const { prompt, steering, duration, aspectRatio, cards } =
      parsed as EnhanceRun
    if (typeof prompt !== 'string' || !Array.isArray(cards)) return null
    // Cast back to "might be anything": the declared type is what a writer
    // promised, and this is a string an older version of the app may have left.
    const valid = (cards as Array<Partial<EnhanceCard> | null>)
      .filter(
        (c): c is EnhanceCard =>
          typeof c?.modelId === 'string' && typeof c.output === 'string',
      )
      // A run stored mid-flight comes back with cards still pending, and
      // nothing is in flight any more to settle them. They are failures now.
      .map((c) =>
        c.status === 'pending'
          ? { ...c, status: 'error' as const, error: 'Interrupted' }
          : c,
      )
    if (valid.length === 0) return null
    return {
      prompt,
      steering: typeof steering === 'string' ? steering : '',
      ...(typeof duration === 'number' ? { duration } : {}),
      ...(typeof aspectRatio === 'string' ? { aspectRatio } : {}),
      cards: valid,
    }
  } catch {
    return null
  }
}
