/**
 * A Final Cut script (#634): the rough cut rewritten as a sequence of 5–15
 * second sections, each a complete MiniMax H3 multi-shot prompt, meant to be
 * copied one at a time into Video and run by hand. Text only; nothing here
 * spends.
 *
 * Pure so it can be tested without a model: the parser reads the shot
 * timestamps the writer is asked for and the validator holds it to the
 * section's duration, because timing arithmetic is where the writer's own
 * instructions say it fails.
 */

const SHOT_LINE =
  /^\[Shot (\d+)\] \[(\d{2}):(\d{2})\.(\d{3}) - (\d{2}):(\d{2})\.(\d{3})\]/

export interface ScriptShot {
  number: number
  start: number
  end: number
}

function seconds(m: string, s: string, ms: string) {
  return Number(m) * 60 + Number(s) + Number(ms) / 1000
}

/** Every `[Shot N] [start - end]` line, in the order written. */
export function parseShots(text: string): Array<ScriptShot> {
  return text
    .split('\n')
    .map((line) => line.trim().match(SHOT_LINE))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => ({
      number: Number(m[1]),
      start: seconds(m[2], m[3], m[4]),
      end: seconds(m[5], m[6], m[7]),
    }))
}

/**
 * The reason a section's script cannot be used, or null. Contiguous shots
 * from zero whose last end is the duration, plus the two labelled blocks the
 * H3 format needs after them.
 */
export function scriptProblem(text: string, duration: number): string | null {
  const shots = parseShots(text)
  if (!shots.length)
    return 'No shot lines found. Each shot starts "[Shot N] [mm:ss.mmm - mm:ss.mmm]".'
  const close = (a: number, b: number) => Math.abs(a - b) < 0.0015
  if (!close(shots[0].start, 0))
    return 'The first shot must start at 00:00.000.'
  for (let i = 1; i < shots.length; i++) {
    if (!close(shots[i].start, shots[i - 1].end))
      return `Shot ${shots[i].number} must start where shot ${shots[i - 1].number} ends.`
  }
  const last = shots[shots.length - 1]
  if (!close(last.end, duration))
    return `The final timestamp is ${last.end.toFixed(3)}s; this section is ${duration} seconds, so it must be ${formatTime(duration)}.`
  if (!/^overall_soundscape:/m.test(text))
    return 'Missing the "overall_soundscape:" block.'
  if (!/^non_diegetic_music:/m.test(text))
    return 'Missing the "non_diegetic_music:" block.'
  return null
}

export function formatTime(total: number) {
  const m = Math.floor(total / 60)
  const s = total - m * 60
  return `${String(m).padStart(2, '0')}:${s.toFixed(3).padStart(6, '0')}`
}

/** H3's text-to-video ratios, and the one nearest to a frame's shape. */
const RATIOS: Array<[string, number]> = [
  ['16:9', 16 / 9],
  ['9:16', 9 / 16],
  ['1:1', 1],
  ['4:3', 4 / 3],
  ['3:4', 3 / 4],
  ['21:9', 21 / 9],
]
export function nearestAspect(width: number, height: number) {
  if (!width || !height) return '16:9'
  const ratio = width / height
  return RATIOS.reduce((best, cur) =>
    Math.abs(cur[1] - ratio) < Math.abs(best[1] - ratio) ? cur : best,
  )[0]
}

/**
 * What rendering a script costs (#640). H3 Max Turbo at 480P, from FAL's
 * rate card on 2026-09-12: $0.00625 per second of clip. H3 has billed on 1.2x
 * the requested duration before (`video/models.ts`), so this is an estimate
 * and the dialog says so.
 */
export const RENDER_USD_PER_SECOND = 0.00625
/** Wall-clock per section: queue, a Turbo generation, download, end frame.
 *  Sequential by nature, since each section starts on the last one's end
 *  frame. A round number from the hand-run, not a measurement. */
export const RENDER_SECONDS_PER_SECTION = 75
export function renderEstimate(sections: ReadonlyArray<{ duration: number }>) {
  const seconds = sections.reduce((sum, s) => sum + s.duration, 0)
  return {
    seconds,
    usd: seconds * RENDER_USD_PER_SECOND,
    minutes: Math.max(
      1,
      Math.round((sections.length * RENDER_SECONDS_PER_SECTION) / 60),
    ),
  }
}

/** The whole script as one copyable text. */
export function scriptText(script: {
  title: string
  story: string
  continuity: string
  style: string
  sections: Array<{ index: number; duration: number; text: string }>
}) {
  return [
    script.title,
    '',
    script.story,
    '',
    `Continuity: ${script.continuity}`,
    '',
    `Style: ${script.style}`,
    ...script.sections.flatMap((section) => [
      '',
      `--- Section ${section.index + 1} · ${section.duration}s ---`,
      '',
      section.text.trim(),
    ]),
  ].join('\n')
}
