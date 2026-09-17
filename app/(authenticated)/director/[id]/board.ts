import { z } from 'zod'
import type { BoardScene } from '../_lib/types'
import type { ScriptLine } from './script'
import { IMAGE_MODELS } from '#/features/ai-images/models'

/**
 * Everything a storyboard frame is made with (#695).
 *
 * The same lock-down the reference sheets have (`refs.ts`): one model, one
 * shape, no aspect and no resolution. A storyboard is judged as a sequence, so
 * every frame in it has to be the same kind of picture.
 */

/**
 * The plan, as the model answers it.
 *
 * Numbers, never ids, exactly as the inventory does it: a line is a number and
 * a sheet is a number. An id is 36 characters of nothing for a model to hold
 * and one wrong character is somebody else's row. `assembleScenes` maps them
 * back and drops every number it was not given.
 *
 * Plain numbers and no array bounds: Anthropic's native output format rejects
 * `minItems`/`maxItems` and the `minimum`/`maximum` Zod emits for `.int()`,
 * which is the wall `inventory` hit first. The counting and the rounding are
 * done below.
 *
 * Here rather than beside the call that makes it, so the mapping is testable
 * without a server module in the graph.
 */
export const storyboardPlanSchema = z.object({
  scenes: z.array(
    z.object({
      title: z.string().min(1),
      lines: z.array(z.number()),
      location: z.number().nullable(),
      characters: z.array(z.number()),
      opening: z.string().min(1),
      closing: z.string().min(1),
    }),
  ),
})
export type StoryboardPlan = z.infer<typeof storyboardPlanSchema>

/** More scenes than this is the model having planned shots rather than scenes.
 *  The instruction asks for three to eight; this is what makes it true. */
export const MAX_SCENES = 12

/** 16:9, as the sheets are: a frame of a film, whatever shape the clips are. */
export const FRAME_RATIO = '16:9'

/** Nano Banana 2 draws the frames, alone -- 8c an image, which is the whole
 *  argument for answering this question in stills. A six-scene board is twelve
 *  images against $38 for one video pass over the same script. */
export const FRAME_MODEL_SLUG = 'nano-banana-2'

/**
 * How many sheets one opening frame is generated from.
 *
 * The scene's location plus its characters, capped: a frame wants the place and
 * whoever is in it, and past that each extra sheet is another multi-megabyte
 * upload for a face the frame does not show.
 */
export const MAX_SCENE_REFS = 4

/** What a re-run may be generated with. One model, not a multi-select: a
 *  re-run replaces the scene's pair, and three models replacing one pair is
 *  three storyboards. */
export const RERUN_MODEL_SLUGS = [
  'nano-banana-2',
  'gpt-image-2.5-flare',
  'gpt-image-2.5-sunburst',
] as const

export function rerunModelOptions() {
  return RERUN_MODEL_SLUGS.map((slug) => {
    const model = IMAGE_MODELS.find((m) => m.slug === slug)
    return {
      slug,
      name: model?.name ?? slug,
      price: model?.editPrice ?? model?.price,
    }
  })
}

/** A sheet, as the board needs it: an id and what to call it. */
export interface BoardSheet {
  id: string
  title: string
  description: string | null
}

/**
 * The plan, mapped back onto the session's own rows.
 *
 * **Every number the model returned is checked here rather than trusted.** A
 * line number outside the script is dropped, a sheet number outside the list is
 * dropped, and a scene left with no lines at all is dropped with them -- the
 * same rule the inventory follows for a frame number it was never shown. The
 * scenes are then renumbered from one, so the board is contiguous whatever came
 * back.
 */
export function assembleScenes({
  plan,
  lines,
  characters,
  locations,
  newId,
}: {
  plan: StoryboardPlan
  lines: Array<ScriptLine>
  characters: Array<BoardSheet>
  locations: Array<BoardSheet>
  /** Injected so a test can read the ids it produced. */
  newId: () => string
}): Array<BoardScene> {
  const byNumber = new Map(lines.map((line) => [line.number, line]))
  /* A number the model returned, mapped back to a row -- or nothing, when it
     named a sheet it was never shown. Bounds-checked by hand because indexed
     access is not checked by the compiler here. */
  const pickSheet = (list: Array<BoardSheet>, n: number): string | null => {
    const index = Math.round(n) - 1
    return index >= 0 && index < list.length ? list[index].id : null
  }

  return plan.scenes
    .flatMap((scene, index) => {
      const covered = [...new Set(scene.lines.map((n) => Math.round(n)))]
        .sort((a, b) => a - b)
        .flatMap((n) => {
          const line = byNumber.get(n)
          return line ? [line] : []
        })
      if (covered.length === 0) return []

      const spoken = covered.filter((line) => line.spoken)
      const seconds = covered.reduce(
        (total, line) => total + (line.seconds ?? 0),
        0,
      )
      const locationId =
        scene.location === null
          ? null
          : (pickSheet(locations, scene.location) ?? null)
      const characterIds = [
        ...new Set(
          scene.characters
            .map((n) => pickSheet(characters, n))
            .filter((id): id is string => !!id),
        ),
      ].slice(0, locationId ? MAX_SCENE_REFS - 1 : MAX_SCENE_REFS)

      return [
        {
          id: newId(),
          number: index + 1,
          title: scene.title.trim().slice(0, 200),
          lines: spoken.map((line) => line.line),
          seconds: seconds > 0 ? seconds : null,
          characterIds,
          locationId,
          openingPrompt: scene.opening.trim().slice(0, 4000),
          closingPrompt: scene.closing.trim().slice(0, 4000),
          guidance: null,
          openingId: null,
          closingId: null,
        },
      ]
    })
    .map((scene, index) => ({ ...scene, number: index + 1 }))
}

/** The sheets one opening frame is generated from: the place, then who is in
 *  it. The location first because it is the one every frame of the scene
 *  shares. */
export function sceneReferenceIds(scene: BoardScene): Array<string> {
  return [
    ...(scene.locationId ? [scene.locationId] : []),
    ...scene.characterIds,
  ].slice(0, MAX_SCENE_REFS)
}

/** What a frame is doing, as the row draws it. */
export type FrameState = 'none' | 'pending' | 'completed' | 'failed'

export function frameState(
  id: string | null,
  status: Record<string, 'pending' | 'completed' | 'failed'>,
): FrameState {
  if (!id) return 'none'
  return status[id] ?? 'pending'
}

/**
 * Which scenes are waiting for their closing frame.
 *
 * **The closing frame cannot be submitted with the opening one.** It is
 * generated *from* it, and a reference is bytes out of the bucket -- there is
 * nothing behind a pending row to upload. So Create storyboard submits the
 * openings and this is what the page drains as each one lands: one scene at a
 * time, in order, because the board is a sequence and watching it fill from the
 * top is how it is read.
 *
 * A failed opening yields nothing: there is no frame to derive from, and the
 * row says so rather than quietly trying.
 */
export function scenesToClose(
  scenes: Array<BoardScene>,
  status: Record<string, 'pending' | 'completed' | 'failed'>,
): Array<BoardScene> {
  return scenes.filter(
    (scene) =>
      scene.closingId === null &&
      scene.openingId !== null &&
      status[scene.openingId] === 'completed',
  )
}
