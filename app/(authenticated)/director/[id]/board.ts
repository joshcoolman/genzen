import { z } from 'zod'
import { REF_MODEL_SLUG, refModel } from './gen'
import type { BoardScene } from '../_lib/types'
import type { ScriptLine } from './script'
import { IMAGE_MODELS } from '#/features/ai-images/models'
import { estimateCostCents } from '#/features/video/models'

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
 * **One entry per numbered script line, because a scene is a line.** The line
 * is what will be generated as a video section of its own stated length, so
 * the boundaries are the script's and the model is never asked to find them --
 * it is handed a line and describes the two frames that section runs between.
 * An earlier cut had it group lines into scenes of its own; a scene is what
 * the script numbers, and nothing should be guessing at that.
 *
 * Numbers, never ids, exactly as the inventory does it: a line is a number and
 * a sheet is a number. An id is 36 characters of nothing for a model to hold
 * and one wrong character is somebody else's row. `assembleScenes` maps them
 * back and drops every number it was not given.
 *
 * Plain numbers and no array bounds: Anthropic's native output format rejects
 * `minItems`/`maxItems` and the `minimum`/`maximum` Zod emits for `.int()`,
 * which is the wall `inventory` hit first. The rounding is done below.
 *
 * Here rather than beside the call that makes it, so the mapping is testable
 * without a server module in the graph.
 */
export const storyboardPlanSchema = z.object({
  scenes: z.array(
    z.object({
      line: z.number(),
      location: z.number().nullable(),
      characters: z.array(z.number()),
      opening: z.string().min(1),
      closing: z.string().min(1),
      /** The line respelled so it is said correctly, or null when nothing in
       *  it would be mispronounced (#700). */
      spoken: z.string().nullable(),
    }),
  ),
})
export type StoryboardPlan = z.infer<typeof storyboardPlanSchema>

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
 * **Driven by the script, not by the answer.** The scenes are the numbered
 * lines, in the script's own order and carrying the script's own numbers --
 * never renumbered, because the number is the position in the run and the
 * Script tab prints the same one. The model's entries are looked up by line
 * number, and a line it did not answer for simply has no frames to draw and
 * drops out; that is visible as a board shorter than the script, which is the
 * honest reading of what happened.
 *
 * **Every other number is checked rather than trusted**, the inventory's rule:
 * a sheet number outside the list it was shown is no sheet at all, never
 * somebody else's row.
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
  const planned = new Map(
    plan.scenes.map((scene) => [Math.round(scene.line), scene]),
  )
  /* A number the model returned, mapped back to a row -- or nothing, when it
     named a sheet it was never shown. Bounds-checked by hand because indexed
     access is not checked by the compiler here. */
  const pickSheet = (list: Array<BoardSheet>, n: number): string | null => {
    const index = Math.round(n) - 1
    return index >= 0 && index < list.length ? list[index].id : null
  }

  return lines.flatMap((line) => {
    const scene = planned.get(line.number)
    if (!scene) return []

    const locationId =
      scene.location === null ? null : pickSheet(locations, scene.location)
    const characterIds = [
      ...new Set(
        scene.characters
          .map((n) => pickSheet(characters, n))
          .filter((id): id is string => id !== null),
      ),
    ].slice(0, locationId ? MAX_SCENE_REFS - 1 : MAX_SCENE_REFS)

    return [
      {
        id: newId(),
        number: line.number,
        line: line.line,
        seconds: line.seconds,
        characterIds,
        locationId,
        openingPrompt: scene.opening.trim().slice(0, 4000),
        closingPrompt: scene.closing.trim().slice(0, 4000),
        spokenLine: spokenOf(scene.spoken, line.line),
        guidance: null,
        model: null,
        openingId: null,
        closingId: null,
        videoIds: [],
      },
    ]
  })
}

/**
 * The respelling to store for a line, or null (#700).
 *
 * **Null when it adds nothing**, which is most lines: a respelling identical
 * to the line is noise on the row and a value to keep in step for no reason.
 * Null is also what a model returns for a line with nothing hard in it, so the
 * two agree.
 */
export function spokenOf(spoken: string | null, line: string): string | null {
  const said = spoken?.trim()
  if (!said || said === line.trim()) return null
  return said.slice(0, 4000)
}

/** What a section is actually told to say: the respelling when there is one,
 *  and the line itself otherwise. The one place the two are chosen between. */
export function lineToSpeak(scene: BoardScene): string {
  return scene.spokenLine ?? scene.line
}

/** The sheets a scene is drawn from: the place, then who is in it. The location
 *  first because it is the one thing every frame of the scene shares. */
export function sceneReferenceIds(scene: BoardScene): Array<string> {
  return [
    ...(scene.locationId ? [scene.locationId] : []),
    ...scene.characterIds,
  ].slice(0, MAX_SCENE_REFS)
}

/**
 * What the closing frame is generated from: its own opening frame **and the
 * same sheets the opening had**.
 *
 * The opening frame leads, because the closing one is the same shot a few
 * seconds later and that picture is what it continues from. But the sheets ride
 * along with it: without them the identity and the place are only as good as
 * whatever survived one generation, and a face drifts by being copied from a
 * copy. Every frame of every scene sees the character and the location it is
 * supposed to be of.
 */
export function closingReferenceIds(
  scene: BoardScene,
  openingId: string,
): Array<string> {
  return [openingId, ...sceneReferenceIds(scene)]
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

/**
 * Turning one row into the clip it was a spec for (#697).
 *
 * **Kling O3 Pro's reference endpoint, and nothing is chosen.** It is the only
 * model that takes a first frame and references on one request, which is
 * exactly what a row holds -- the same reason the run's Add ref lands there
 * (`gen.ts`). Fixed 16:9, and the duration is the line's own seconds, so there
 * is nothing to pick.
 */
export const SECTION_MODEL_SLUG = REF_MODEL_SLUG

export const SECTION_RATIO = '16:9'

/**
 * What one section is submitted at.
 *
 * The line's own seconds, which came from `durationForWords` rather than from a
 * model -- so the clip runs as long as the words take to say. Clamped to what
 * the endpoint names (3 to 15, every integer), and rounded, because a stored
 * duration is a number and the endpoint's is an enum of strings. A row with no
 * recorded duration falls back to the model's own default rather than guessing.
 */
export function sectionDuration(seconds: number | null): number {
  const model = refModel()
  const offered = model.durations
  if (seconds === null) return model.defaultDuration
  const rounded = Math.round(seconds)
  if (offered.includes(rounded)) return rounded
  return offered.reduce((best, value) =>
    Math.abs(value - rounded) < Math.abs(best - rounded) ? value : best,
  )
}

/** What this row costs to generate, printed before the press as everywhere
 *  else that spends. Audio on, which is what the row is for. */
export function sectionCostCents(seconds: number | null): number {
  return estimateCostCents(
    refModel(),
    sectionDuration(seconds),
    undefined,
    true,
  )
}

/** What the board has spent on video so far.
 *
 *  **The bar carries it because the button is on every row.** Thirty-two rows
 *  at 70c to $1.68 each is the same bill the storyboard exists to avoid,
 *  available one click at a time; a running total is what makes spending it
 *  a decision rather than an accident. */
export function boardVideoCostCents(scenes: Array<BoardScene>): number {
  return scenes.reduce(
    (total, scene) =>
      total + scene.videoIds.length * sectionCostCents(scene.seconds),
    0,
  )
}
