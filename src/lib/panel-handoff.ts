'use client'

/**
 * A one-shot delivery to the Images generator panel (#433).
 *
 * **The door between a page that composes a request and the page that runs
 * it.** The lab writes prompts and picks images; Images owns the panel that
 * fires them. Neither should know the other exists, and neither does: this
 * module is the whole of what they share.
 *
 * One record, overwritten by each write, **read once and cleared** by whoever
 * mounts the panel. Deliberately not a queue, not a merge and not a
 * subscription:
 *
 * - the panel is a single working surface, so a second handoff replacing the
 *   first is the honest behaviour -- merging two sets of prompts into a
 *   half-written panel produces a run nobody can read;
 * - it is consumed on arrival, so a reload of Images does not silently refill
 *   a panel the user has since edited;
 * - nothing tracks whether it was ever collected. The sender's "Loaded" is a
 *   local flag on a button, not a fact anyone stores or reconciles. If the
 *   panel changes underneath it, the button is stale, and that is fine.
 *
 * localStorage rather than a URL param or a router state object: the payload
 * carries several prompts, and it has to survive a full page load, which is
 * what a link to another route is.
 *
 * **It carries a request, never a result.** Nothing here generates anything or
 * spends money -- it fills a form. Anything that wants to follow what the panel
 * then does needs cross-route state, which is exactly what this exists to
 * avoid.
 */

const KEY = 'genzen:panel-handoff'

/** An image by identity, which is the only way the panel accepts one (#297):
 *  bytes with no library row cannot be replayed. */
export interface HandoffImage {
  id: string
  url: string
  title: string
}

export interface PanelHandoff {
  /** Replaces the panel's list outright. Empty entries are the caller's
   *  business; the submit ignores them. */
  prompts: Array<string>
  /** Goes to slot 0 -- the slot the aspect ratio follows and the submit sends
   *  first. Omitted leaves the panel's set alone. */
  primaryImage?: HandoffImage
}

/** Leave a handoff for the next panel to mount. Overwrites any previous one. */
export function writePanelHandoff(handoff: PanelHandoff): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(handoff))
  } catch {
    // A full or blocked store loses the handoff, and losing it is the correct
    // failure: the user is one click from trying again, and a half-applied
    // panel is worse than an unchanged one.
  }
}

/**
 * Collect the handoff and clear it. Null when there is nothing waiting.
 *
 * Reading and clearing are one operation on purpose -- two callers, or one
 * caller that mounts twice, must not both apply the same delivery.
 */
export function takePanelHandoff(): PanelHandoff | null {
  let raw: string | null
  try {
    raw = localStorage.getItem(KEY)
    if (raw) localStorage.removeItem(KEY)
  } catch {
    return null
  }
  if (!raw) return null

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const { prompts, primaryImage } = parsed as PanelHandoff
    if (!Array.isArray(prompts)) return null
    return {
      prompts: prompts.filter((p) => typeof p === 'string'),
      ...(primaryImage?.id ? { primaryImage } : {}),
    }
  } catch {
    return null
  }
}
