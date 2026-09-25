import type { RunEvent, RunSource } from './types'

/**
 * A News run paced like a real one, for judging the overlay without paying for
 * one (#725). Uneven on purpose: a burst of sources, a long quiet stretch while
 * the model writes, heroes finishing out of order, one of them failing.
 *
 * The text is invented. It stands in for what #737 will surface from a real
 * run and must never ship as if it were.
 */
const SCRIPT: Array<[number, RunEvent]> = [
  [0, { kind: 'activity', text: 'Searching the web' }],
  [
    2200,
    { kind: 'snippet', label: 'Searching', text: 'new video models this week' },
  ],
  [4800, { kind: 'snippet', label: 'Reading', text: 'fal.ai / changelog' }],
  [
    6100,
    {
      kind: 'snippet',
      label: 'Reading',
      text: 'blog.google / Veo release notes',
    },
  ],
  [
    9400,
    {
      kind: 'snippet',
      label: 'Searching',
      text: 'open weights image model release',
    },
  ],
  [
    11800,
    { kind: 'snippet', label: 'Reading', text: 'huggingface.co / model card' },
  ],
  [13000, { kind: 'snippet', label: 'Reading', text: 'x.com / launch thread' }],
  [16500, { kind: 'activity', text: 'Writing posts' }],
  // The quiet stretch: research and writing are one call today.
  [
    29000,
    {
      kind: 'snippet',
      label: 'Headline',
      text: 'Kling 3 adds multi-shot scenes from one prompt',
    },
  ],
  [
    30200,
    {
      kind: 'snippet',
      label: 'Headline',
      text: 'An open 12B image model matches last year’s best',
    },
  ],
  [
    31100,
    {
      kind: 'snippet',
      label: 'Headline',
      text: 'Veo gets reference-locked characters',
    },
  ],
  [
    32000,
    {
      kind: 'snippet',
      label: 'Headline',
      text: 'Topaz ships a video upscaler that keeps grain',
    },
  ],
  [33000, { kind: 'activity', text: 'Illustrating 4 posts' }],
  [33000, { kind: 'item', done: 0, total: 4 }],
  [
    34500,
    {
      kind: 'snippet',
      label: 'Illustrating',
      text: 'a filmstrip folding into a paper crane',
    },
  ],
  [
    35600,
    {
      kind: 'snippet',
      label: 'Illustrating',
      text: 'two identical faces, one in shadow',
    },
  ],
  [
    47000,
    {
      kind: 'item',
      done: 1,
      total: 4,
      text: 'Veo gets reference-locked characters',
    },
  ],
  [
    52500,
    { kind: 'item', done: 2, total: 4, text: 'Kling 3 adds multi-shot scenes' },
  ],
  [61000, { kind: 'item', done: 3, total: 4, text: 'An open 12B image model' }],
  [
    64000,
    {
      kind: 'snippet',
      label: 'Image failed',
      text: 'Topaz post -- retry from its card',
      tone: 'failed',
    },
  ],
  [64200, { kind: 'item', done: 4, total: 4 }],
  [
    65000,
    {
      kind: 'end',
      outcome: 'success',
      text: '4 new articles ready',
      href: '/news',
    },
  ],
]

export const fakeNewsRun: RunSource = (emit) => {
  const timers = SCRIPT.map(([at, event]) => setTimeout(() => emit(event), at))
  return () => timers.forEach(clearTimeout)
}
