import 'server-only'
import { generateText } from 'ai'
import sharp from 'sharp'
import { formatTime, nearestAspect, scriptProblem } from '../final-script'
import type { FinalPlan } from './final-cut'
import type { SavedExport } from './types'
import { ai, requireAiRole } from '#/lib/server/ai.server'
import instructions from '#/lib/prompts/director-script.md'

/**
 * The second call of a Script job (#634), once per section: the plan's shot
 * becomes a complete H3 multi-shot prompt, written knowing the section before
 * it and the direction of the one after.
 *
 * One call per section rather than the whole film in one, because the H3
 * writer's own instructions say timing arithmetic is where it fails; a
 * section is short enough to get its timestamps right, and `scriptProblem`
 * checks that it did. One bounded repair, then a loud failure: a script that
 * looks right and is timed wrong is the thing not to hand over.
 */
export async function writeSectionScript({
  plan,
  source,
  index,
  aspectRatio,
  previous,
  beforeRequest = () => Promise.resolve(),
}: {
  plan: FinalPlan
  source: SavedExport
  index: number
  aspectRatio: string
  /** The finished text of section `index - 1`, or null for the opening. */
  previous: string | null
  beforeRequest?: () => Promise<void>
}) {
  requireAiRole('reasoning')
  const shot = plan.shots[index]
  const next = plan.shots.at(index + 1)
  let repair: { attempt: string; problem: string } | undefined
  for (let attempt = 0; attempt < 2; attempt++) {
    await beforeRequest()
    const { text } = await generateText({
      model: ai.reasoning,
      system: instructions,
      maxOutputTokens: 3000,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(180000),
      messages: [
        {
          role: 'user',
          content: JSON.stringify({
            duration: shot.duration,
            durationLabel: formatTime(shot.duration),
            aspectRatio,
            section: index + 1,
            sectionCount: plan.shots.length,
            story: plan.story,
            continuity: plan.continuity,
            style: plan.style,
            direction: shot.prompt,
            // The user's own words for the rough-cut sections this shot
            // covers: what they asked for, beside what the planner made of it.
            roughDirections: shot.sections.map(
              (section) => source.source.at(section)?.prompt ?? '',
            ),
            previousSection: previous,
            nextSectionDirection: next?.prompt ?? null,
            repair,
          }),
        },
      ],
    })
    const script = text.trim()
    const problem = scriptProblem(script, shot.duration)
    if (!problem) return script
    repair = { attempt: script, problem }
  }
  throw new Error(
    `Section ${index + 1} could not be timed to ${shot.duration} seconds: ${repair?.problem ?? 'unknown problem'}`,
  )
}

/** The shape the film was cut at, read off one sampled frame. */
export async function frameAspect(frame: Blob) {
  try {
    const meta = await sharp(Buffer.from(await frame.arrayBuffer())).metadata()
    return nearestAspect(meta.width, meta.height)
  } catch {
    return nearestAspect(0, 0)
  }
}
