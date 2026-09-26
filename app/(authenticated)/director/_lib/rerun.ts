import { countWords, durationForWords } from '#/lib/server/director-chat.server'

/**
 * New cut from script (#744): the pure half -- how a planned shot becomes the
 * prompt and the length it is generated at. The model calls are in
 * `rerun.server.ts`.
 */

/** The most shots one cut may plan. Every one is a clip submitted at once. */
export const MAX_SHOTS = 30

export interface CastMember {
  name: string
  description: string
}

export interface PlannedShot {
  scene: number
  action: string
  speaker: string
  spoken: string
}

/**
 * The cast as one block of prose, prepended to every shot.
 *
 * Written by the model once per cut and pinned, exactly as a chat's character
 * is: the anchors go in front of every clip in code, so the model writes each
 * shot's action and nothing else, and the picture has one description to hold
 * to rather than one paraphrase per shot.
 */
export function composeCast(look: string, characters: Array<CastMember>) {
  return [
    look.trim(),
    ...characters.map(
      (member) => `${member.name.trim()}: ${member.description.trim()}`,
    ),
  ]
    .filter(Boolean)
    .join(' ')
}

/** The prompt one shot is generated from: the cast, the place, the action,
 *  then the line -- quoted, as a chat's is, so a shot with words is never a
 *  silent one. */
export function composeShotPrompt(
  cast: string,
  scene: string,
  shot: PlannedShot,
): string {
  const line = shot.spoken.trim().replace(/^["“]+|["”]+$/g, '')
  const speaker = shot.speaker.trim() || 'The character'
  return [
    cast.trim(),
    scene.trim(),
    shot.action.trim(),
    line && `${speaker} says, in English: "${line}"`,
  ]
    .filter(Boolean)
    .join(' ')
}

/**
 * How long a shot runs. A line is timed from its words, never by the model --
 * the chat's rule (#685), for the chat's reason: a model dealing out durations
 * gives a short line fifteen seconds and it comes back as noise. A silent beat
 * gets the shortest the model makes, because a reveal or a record screech is
 * a moment and the film should cut often.
 */
export function shotDuration(
  shot: PlannedShot,
  durations: ReadonlyArray<number>,
): number {
  const words = countWords(shot.spoken)
  return words === 0
    ? Math.min(...durations)
    : durationForWords(words, durations, 'normal')
}
