/**
 * Lighting effects: relight a picture you already have, keeping everything else
 * (#563).
 *
 * **An effect is a fixed instruction, not something written per run.** The
 * subject arrives from the picture; only the light changes. That is what lets
 * this flow take no prompt and no vision pass -- the same shape as `../shots`
 * minus the scene, because a relight has nothing to establish across frames.
 *
 * Three things the 2026-09-01 test outside the app established, kept here
 * because it is the only record of them:
 *
 * **`wrapper.md` is assembly, not an effect.** It is identical for every one of
 * them and prepended in code, so a new effect is one file plus one entry and
 * never a restatement of "keep the subject".
 *
 * **Sentence order inside an effect is load-bearing.** An early draft of the
 * split field opened with the background fields and came back twice as a
 * backdrop swap with untouched skin. Subject first, and say the skin takes the
 * colour.
 *
 * **The palette is separable, and is not a control yet.** The split field run
 * with its last sentence swapped for a forest-green/amber pair came back as
 * unmistakably the same setup. If palette ever becomes a second dial, that
 * final sentence is the seam to cut on -- which is also why every effect here
 * ends with its colours rather than scattering them through.
 *
 * Same registry shape as `../shots` and `../describe`: wiring only -- id,
 * label, the file, a lazy `import()`. Lazy because the dialog reads this array
 * for its labels, and a static import would put every effect's prose in the
 * browser bundle.
 */
export const LIGHTING_EFFECTS = [
  {
    id: 'soft-split-field',
    label: 'Soft Split Field',
    file: 'src/lib/prompts/lighting/soft-split-field.md',
    system: () => import('./soft-split-field.md'),
    /** Renders the background split and leaves the skin neutral on
     *  `xai/grok-imagine-image/v2.0/edit`. Verified on Nano Banana 2. */
    note: 'Nano Banana only',
  },
  {
    id: 'hard-rake-dark-ground',
    label: 'Hard Rake, Dark Ground',
    file: 'src/lib/prompts/lighting/hard-rake-dark-ground.md',
    system: () => import('./hard-rake-dark-ground.md'),
  },
] as const

export type LightingEffectId = (typeof LIGHTING_EFFECTS)[number]['id']

export function findLightingEffect(id: string) {
  return LIGHTING_EFFECTS.find((e) => e.id === id)
}

/** The instruction every effect is prepended with. Lazy for the same reason. */
export const lightingWrapper = () => import('./wrapper.md')
