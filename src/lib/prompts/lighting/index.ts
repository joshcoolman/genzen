/**
 * Lighting effects: relight a picture you already have, keeping everything else
 * (#563).
 *
 * **An effect describes a lighting setup, not a subject, and it is never sent
 * to an image model as written.** It goes to `writeLighting`, which binds it to
 * the surfaces `writeLightingSubject` found in the actual picture. So an effect
 * names surfaces by their role -- the side that turns away, the surfaces facing
 * the camera, the upper edge, the centre line -- and the picture supplies the
 * nouns. Write one for a face and it works on a face and nothing else; that is
 * how the first pair were written, and a truck came back as a background split
 * with the paint untouched.
 *
 * Four things established by the 2026-09-01 test and the run that followed it,
 * kept here because this is the only record of them:
 *
 * **`wrapper.md` is assembly, not an effect.** It is identical for every one of
 * them and prepended in code, so a new effect is one file plus one entry and
 * never a restatement of "keep the subject".
 *
 * **Sentence order inside an effect is load-bearing.** An early draft of the
 * split field opened with the background fields and came back twice as a
 * backdrop swap with an untouched subject. Subject first, and say those
 * surfaces take the colour. `apply.md` carries the same rule, because pass two
 * is now the thing that can get the order wrong.
 *
 * **Quantities are the effect.** Colours, contrast, brightness, how hard the
 * shadows are, where an edge falls: pass two is told to preserve every one of
 * them and change only which surfaces they land on. Vagueness here does not
 * degrade gracefully -- it is what produced a background swap.
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
    /** Rendered the background split and left the subject neutral on
     *  `xai/grok-imagine-image/v2.0/edit`. Verified on Nano Banana 2. The
     *  note predates the writer passes, which exist to fix that class of
     *  failure -- worth re-judging, and worth keeping until it has been. */
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

/**
 * `wrapper.md`, `subject.md` and `apply.md` are not in this array on purpose:
 * they are the machinery around an effect rather than effects, and nothing
 * picks between them. `write-lighting-prompt.action.ts` imports all three
 * directly, which it can do statically because it is server-only -- the lazy
 * imports here exist for the dialog, which reads this array in the browser for
 * its labels.
 */
