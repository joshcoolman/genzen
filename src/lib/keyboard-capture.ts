/**
 * "Something floating owns the keyboard right now."
 *
 * The search overlay (#213) is mounted globally and opens over routes that have
 * already bound the keyboard to themselves. Canvas is the sharp case: it sets
 * `hotkeys.filter` to a check on its *own* dialogs, which replaces hotkeys-js's
 * default exemption for text fields -- so with the overlay open, Backspace to
 * fix a typo in the query would raise the canvas delete confirm, and Cmd-A
 * would select every card behind it.
 *
 * A route cannot check "is the overlay open" without importing it, and it must
 * not have to: the next floating thing would need the same edit in every route.
 * So the signal is ambient and one line to honour.
 *
 * Module state rather than context on purpose -- the readers are keydown
 * handlers inside `useEffect`, which need the answer synchronously and would
 * otherwise re-subscribe on every change.
 */

let captured = false

export function setKeyboardCaptured(next: boolean): void {
  captured = next
}

/** True while a global overlay is taking keystrokes. Route hotkeys stand down. */
export function isKeyboardCaptured(): boolean {
  return captured
}
