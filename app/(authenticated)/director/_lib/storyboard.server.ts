import 'server-only'
import { generateObject } from 'ai'
import { MAX_SCENES, storyboardPlanSchema } from '../[id]/board'
import type { BoardSheet, StoryboardPlan } from '../[id]/board'
import type { ScriptLine } from '../[id]/script'
import storyboardPrompt from '#/lib/prompts/director-storyboard.md'
import { ai, requireAiRole } from '#/lib/server/ai.server'

/**
 * Planning a session's storyboard (#695).
 *
 * One Claude call that reads the script and the sheets that exist, and answers
 * with scenes: which lines each covers, where it happens, and the two frames it
 * opens and closes on.
 *
 * **A model plans the scenes because nothing stored knows them.** The chat
 * wrote a scene per answer and it only ever lived inside the composed clip
 * prompt, so a session made before this has no record of which line belongs to
 * which scene. Storing it going forward would leave every existing session out,
 * and deriving it by common prefix within a turn guesses at a structure nobody
 * wrote down. Planning it here works on every session that exists today, and is
 * the only option that can also say which location a scene happens in.
 *
 * Numbers in, numbers out, exactly as the inventory does it: a line is a
 * number, a sheet is a number, and an id never reaches the model. An id is 36
 * characters of nothing to hold and one wrong character is somebody else's row.
 */

/** The sheets as a numbered list. Title and description, which is everything
 *  the row records about what a sheet shows -- the picture itself is not sent:
 *  the planner writes scenes, and what the frames look like is settled by the
 *  sheets riding along as references at generation time. */
function sheetList(sheets: Array<BoardSheet>): string {
  return sheets
    .map(
      (sheet, index) =>
        `${index + 1}. ${sheet.title}${sheet.description ? ` -- ${sheet.description}` : ''}`,
    )
    .join('\n')
}

export async function planStoryboard({
  lines,
  characters,
  locations,
}: {
  lines: Array<ScriptLine>
  characters: Array<BoardSheet>
  locations: Array<BoardSheet>
}): Promise<StoryboardPlan> {
  requireAiRole('reasoning')

  /* Plain text rather than JSON: this is a script and two short lists, and the
     model reads them as a person would. The numbers are what matter and they
     are what comes back. */
  const script = lines
    .map(
      (line) =>
        `${line.number}. ${line.seconds === null ? '' : `(${line.seconds}s) `}${line.line}`,
    )
    .join('\n')

  const { object } = await generateObject({
    model: ai.reasoning,
    maxOutputTokens: 8192,
    system: storyboardPrompt,
    schema: storyboardPlanSchema,
    messages: [
      {
        role: 'user',
        content: [
          `Script:\n${script}`,
          `Character sheets:\n${sheetList(characters)}`,
          `Location sheets:\n${sheetList(locations)}`,
        ].join('\n\n'),
      },
    ],
  })

  return { scenes: object.scenes.slice(0, MAX_SCENES) }
}
