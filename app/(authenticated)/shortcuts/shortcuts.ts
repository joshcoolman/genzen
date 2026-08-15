/**
 * Every gesture and key the app answers to, as data (#289).
 *
 * A list rather than prose because the page is a reference: you arrive knowing
 * roughly what you want and scan for it. Grouped by *where you are* rather than
 * by kind, since that is how you look for one -- "what can I do in the picker"
 * is a question, "what are the modifier gestures" is not.
 *
 * **This file is the only copy.** It is written by hand and nothing verifies it
 * against the handlers, which is the standing risk with a page like this: a
 * shortcut that changes and a page that does not is worse than no page. When
 * you change a binding, change it here in the same commit.
 */

export interface Shortcut {
  /** The gesture, written the way it is performed. */
  keys: string
  what: string
  /** The half a table cannot show -- what else moves, or does not. */
  note?: string
}

export interface ShortcutGroup {
  where: string
  /** Why these live together, when the heading does not say it. */
  blurb?: string
  items: Array<Shortcut>
}

export const shortcutGroups: Array<ShortcutGroup> = [
  {
    where: 'In the gallery',
    blurb:
      'The two modifier gestures are the reason this page exists: nothing on a card says they are there, because a two-word hover is the wrong place to teach one. Each replaces exactly one thing and leaves the count, the other prompts and the model selection alone — which is what makes them safe to fire off.',
    items: [
      { keys: 'Click a card', what: 'Open it in the preview' },
      {
        keys: '⌘-click a card',
        what: 'Add that image to Reference images',
        note: 'Opens the panel. Goes on the front of the set and evicts the last one when it is full — a full set is the normal case for this gesture, so it makes room rather than refusing.',
      },
      { keys: 'Click a prompt', what: 'Copy the whole thing' },
      {
        keys: '⌘-click a prompt',
        what: 'Load that text as the prompt',
        note: 'Opens the panel. Replaces the first prompt only, so a second one you are holding on to survives.',
      },
      {
        keys: 'Click a card’s tick',
        what: 'Start selecting',
        note: 'Being in select mode is having something picked. Escape or Deselect all is the way out.',
      },
      { keys: 'Escape', what: 'Clear the selection' },
      {
        keys: 'Click a group’s swatch row',
        what: 'Show every image in that group',
        note: 'Only when there is more than the five already showing.',
      },
      {
        keys: 'Paste an image',
        what: 'Upload it',
        note: 'Into the group you are standing in, if you are in one.',
      },
    ],
  },
  {
    where: 'In the model picker',
    items: [
      { keys: 'Click the header tick', what: 'Select or clear every model' },
      {
        keys: '⌘-click a row',
        what: 'That model and no other',
        note: 'Whatever the row was before — it always ends with exactly that one selected.',
      },
    ],
  },
  {
    where: 'In the preview',
    blurb:
      'The large image that replaces the grid when you click a card. It covers the grid rather than the screen, so the toolbar stays.',
    items: [
      { keys: '← →', what: 'Step through the images' },
      {
        keys: 'Click the left or right quarter',
        what: 'Step, same as the arrow keys',
      },
      { keys: 'Click the middle', what: 'Close it' },
      { keys: 'Escape', what: 'Close it' },
    ],
  },
  {
    where: 'In the lightbox',
    blurb: 'The full-screen overlay on Explore.',
    items: [
      { keys: '← →', what: 'Step through the images' },
      { keys: 'Delete or Backspace', what: 'Send this one to Trash' },
      { keys: 'Escape', what: 'Close it' },
    ],
  },
  {
    where: 'In Activity',
    items: [{ keys: '← →', what: 'Move between entries' }],
  },
  {
    where: 'On the canvas',
    blurb:
      'The canvas takes the keyboard properly, so these work without clicking into anything first — and stand down while a dialog is open.',
    items: [
      { keys: '⌘= / ⌘-', what: 'Zoom in and out' },
      { keys: '⌘1', what: 'Back to 100%' },
      {
        keys: '⌘0',
        what: 'Focus the selection',
        note: 'The whole canvas when nothing is selected.',
      },
      { keys: '⌘2', what: 'Fit the selection edge to edge' },
      { keys: '⌘⇧0', what: 'Fit everything' },
      { keys: '⌘A', what: 'Select all' },
      { keys: 'Escape', what: 'Clear the selection' },
      {
        keys: 'Backspace or Delete',
        what: 'Take the selection off the canvas',
        note: 'The images stay in Images, in whatever group they belong to. The canvas holds references, never originals, so nothing here can lose a picture.',
      },
      { keys: '⌘G / ⌘⇧G', what: 'Group and ungroup' },
    ],
  },
]
