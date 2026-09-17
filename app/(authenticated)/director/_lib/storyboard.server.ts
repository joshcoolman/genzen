import 'server-only'
import { generateObject } from 'ai'
import { storyboardPlanSchema } from '../[id]/board'
import type { BoardSheet, StoryboardPlan } from '../[id]/board'
import type { ScriptLine } from '../[id]/script'
import storyboardPrompt from '#/lib/prompts/director-storyboard.md'
import { ai, requireAiRole } from '#/lib/server/ai.server'

/**
 * Planning a session's storyboard (#695).
 *
 * One Claude call that reads the script and the sheets that exist, and answers
 * with one entry per numbered line: where that line happens, and the two frames
 * the section it becomes runs between.
 *
 * **The boundaries are the script's, not the model's.** A scene is a numbered
 * line, because a numbered line is what gets generated as a video section of
 * its own stated length -- so nothing here has to work out where scenes begin,
 * and the board's numbers are the run's numbers. What the model is for is the
 * part nothing stored knows: what each frame shows, and which location a line
 * is set in. The clip prompts carried a scene, written once per answer, but it
 * only ever lived inside the composed prompt.
 *
 * **The whole script goes in every time, for one line's frames.** The cut
 * between two scenes and the drift of the shot sizes down the film are the
 * things being judged, and neither is visible from one line.
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
    /* One entry per line, and a real script is thirty-odd of them: two frame
       descriptions each is most of the budget. A truncated answer is a board
       short of its last scenes, which reads as the planner having stopped
       early rather than as a limit. */
    maxOutputTokens: 32000,
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

  return object
}
