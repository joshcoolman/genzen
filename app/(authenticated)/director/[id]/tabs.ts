import type { SessionTab } from './use-references'

/**
 * Which tab is actually showing, given what the session still has (#707).
 *
 * **The tab a session is on can stop existing under it.** Script needs a chat
 * and Storyboard needs a script and both kinds of sheet, and both of those are
 * things the page can lose while you are standing on them -- delete the last
 * location sheet from the Storyboard tab and its button stops rendering while
 * its panel stays mounted, with Create storyboard now throwing "a storyboard
 * needs at least one character sheet and one location sheet". Held state that
 * outlives what it points at.
 *
 * Decided once, here, rather than guarded inside each panel: the nav and the
 * body have to answer the same question, and two copies of that question is
 * how they came to disagree in the first place. Work is the fallback because
 * it is what a session opens on and the one tab nothing can take away.
 */
export function visibleTab(
  tab: SessionTab,
  available: { script: boolean; storyboard: boolean },
): SessionTab {
  if (tab === 'script' && !available.script) return 'work'
  if (tab === 'storyboard' && !available.storyboard) return 'work'
  return tab
}
