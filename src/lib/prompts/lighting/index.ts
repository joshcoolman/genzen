/**
 * Lighting effects: relight a picture you already have, keeping everything else
 * (#563).
 *
 * **An effect is a lighting setup, never a description of a photograph.** Say
 * where the sources are, what they are gelled, how hard, how bright, and what
 * the ground behind is doing -- and let the finished picture fall out of that.
 * Nothing describes the subject: the model is looking at it. The split field
 * was first written the other way round, transcribed from a reference image as
 * "two flat fields divided by one hard vertical edge". That is a
 * graphic-design instruction, and models obeyed it as one -- a photograph of a
 * truck came back as two colour rectangles with the paint untouched. The
 * reference was a subject standing in a corner with a cool source on one side
 * and a warm one on the other; the edge was where the walls met.
 *
 * **Nothing writes these at run time, and two passes that did have been
 * deleted.** A vision pass inventoried the subject and a second bound the
 * effect to it. That was the right fix for the wrong prose -- the effects named
 * a cheek and a neck, so something had to supply nouns for a truck. Written as
 * a setup they need no nouns, and a writer between the effect and FAL can only
 * paraphrase precision away. Shots keeps its two passes because sixteen frames
 * of one subject have to agree with each other, which is a requirement Lighting
 * does not have; the shape was imported here on that authority without the
 * reason coming with it.
 *
 * **Colours are `{TOKEN}` placeholders with defaults on the effect.** The gels
 * are the one part of a setup that is genuinely arbitrary -- the split field
 * run with forest green and amber gold came back as unmistakably the same
 * setup -- so they are the seam a control can cut on later without touching
 * prose. `buildLightingPrompt` substitutes them and throws on a token no effect
 * declares, because an unresolved `{COOL_GEL}` reaching FAL renders as a
 * picture rather than an error.
 *
 * Two things a new effect should keep:
 *
 * **`wrapper.md` is assembly, not an effect.** Identical for every one of them
 * and prepended in code, so a new effect is one file plus one entry and never a
 * restatement of "keep the subject".
 *
 * **The housekeeping line does not hold a source out of frame.** Every effect
 * ends by saying there is no visible beam and no visible fixture, and on the
 * shipped side-lit setups nothing ever draws one. The overhead single source is
 * different: on a hard-surfaced subject against a dark ground, Grok drew the
 * lamp and its throw in six of six candidates across three phrasings, including
 * one that put the fixture outside the frame in the setup and described what
 * the frame holds instead. It is a model finding rather than prose to fix --
 * the same effect on a face is exactly right -- and it is written down so the
 * next overhead effect does not spend three rounds rediscovering it (#576).
 *
 * **Nothing in an effect may depend on which gels are loaded.** "Dusty pink
 * midtones" is true of teal and coral and of nothing else; the meeting zone
 * says "midtones between them" instead. A phrase that only works for the
 * defaults is a default hiding outside the seam.
 */
export const LIGHTING_EFFECTS = [
  {
    id: 'soft-split-field',
    label: 'Soft Split Field',
    file: 'src/lib/prompts/lighting/soft-split-field.md',
    system: () => import('./soft-split-field.md'),
    gels: {
      COOL_GEL: 'a deep cyan-teal',
      WARM_GEL: 'a warm coral red leaning magenta-orange',
    },
  },
  {
    id: 'hard-rake-dark-ground',
    label: 'Hard Rake, Dark Ground',
    file: 'src/lib/prompts/lighting/hard-rake-dark-ground.md',
    system: () => import('./hard-rake-dark-ground.md'),
    gels: {
      RAKE_GEL: 'a saturated red',
      FRONT_GEL: 'a cold cyan blue',
      GROUND_GEL: 'deep navy',
    },
  },
  {
    id: 'hard-top-deep-wells',
    label: 'Hard Top, Deep Wells',
    file: 'src/lib/prompts/lighting/hard-top-deep-wells.md',
    system: () => import('./hard-top-deep-wells.md'),
    gels: {},
  },
  {
    id: 'neutral-key-coloured-rim',
    label: 'Neutral Key, Coloured Rim',
    file: 'src/lib/prompts/lighting/neutral-key-coloured-rim.md',
    system: () => import('./neutral-key-coloured-rim.md'),
    gels: {
      RIM_GEL: 'an electric blue',
    },
  },
  {
    id: 'soft-front-white-ground',
    label: 'Soft Front, White Ground',
    file: 'src/lib/prompts/lighting/soft-front-white-ground.md',
    system: () => import('./soft-front-white-ground.md'),
    gels: {},
  },
] as const

export type LightingEffectId = (typeof LIGHTING_EFFECTS)[number]['id']

export function findLightingEffect(id: string) {
  return LIGHTING_EFFECTS.find((e) => e.id === id)
}
