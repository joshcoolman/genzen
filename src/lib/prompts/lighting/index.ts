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
 * **An effect describes a lighting setup, never a finished picture.** Say where
 * the sources are, what they are gelled, what the room behind is shaped like --
 * and let what the photograph looks like fall out of that. The split field was
 * written the other way round, from a reference image, as "two flat fields
 * divided by one hard vertical edge". That is a description of the artifact:
 * the reference is a subject standing in a corner with a cool source on one
 * side and a warm one on the other, and the edge is where the two walls meet.
 * Written as an outcome it is a graphic-design instruction, and models obeyed
 * it as one -- a vehicle came back as two colour rectangles with the paint
 * untouched. The two writer passes cannot rescue this: they bind an effect's
 * surface references to a real subject, and an effect with no causes in it has
 * nothing to bind. The hard rake never had the problem because it was written
 * as a setup from the start, which is why it is the one that generalises.
 *
 * Five things established by the 2026-09-01 test and the runs that followed it,
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
