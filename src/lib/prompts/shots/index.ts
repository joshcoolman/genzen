/**
 * Sixteen camera positions for producing a shot set from one reference image.
 *
 * **Nothing here describes a subject.** The subject arrives from the picture;
 * only the camera moves. That is why a shot is a fixed instruction rather than
 * something written per run -- and why the flow takes no prompt at all.
 *
 * These are not sketches. They were run before this feature existed (#553):
 * sixteen prompts typed by hand into the prompt list, one mech reference, FLUX
 * Kontext Pro, and the set came back usable, on-angle and identity-stable. Two
 * things that run established, kept here because the doc that recorded them
 * (`docs/reference/camera-angles.md`) is gone:
 *
 * **`constant.md` is insurance, not the mechanism.** The shot descriptions
 * carried the result largely on their own. Do not grow it.
 *
 * **Sixteen is near the honest ceiling for one reference.** Every frame here is
 * a reprojection of what the picture actually shows. Push further and the
 * remaining positions are ones the source never captured, so the model invents
 * geometry rather than deriving it -- plausible, and no longer the same subject.
 *
 * **`needsBack` marks the three that drift first.** Rear Three-Quarter, Direct
 * Rear and Over-and-Behind are already partly invented unless the reference
 * actually shows the subject's back -- the source has no pixels for what they
 * ask to see. They stay in the set because they are right for a reference that
 * does show it; the flag is what stops a grid of sixteen presenting them as
 * equally reliable.
 *
 * Same registry shape as `../describe` and `../multi-shot`: wiring only -- id,
 * label, the file, a lazy `import()`. `system` is lazy because the dialog reads
 * this array for its labels, and a static import would put all sixteen shot
 * descriptions in the browser bundle.
 */
export const SHOTS = [
  {
    id: 'neutral-three-quarter',
    label: 'Neutral Three-Quarter',
    file: 'src/lib/prompts/shots/neutral-three-quarter.md',
    system: () => import('./neutral-three-quarter.md'),
  },
  {
    id: 'worms-eye-hero',
    label: "Worm's-Eye Hero",
    file: 'src/lib/prompts/shots/worms-eye-hero.md',
    system: () => import('./worms-eye-hero.md'),
  },
  {
    id: 'low-oblique-full-view',
    label: 'Low Oblique Full View',
    file: 'src/lib/prompts/shots/low-oblique-full-view.md',
    system: () => import('./low-oblique-full-view.md'),
  },
  {
    id: 'side-on-compression',
    label: 'Side-On Compression',
    file: 'src/lib/prompts/shots/side-on-compression.md',
    system: () => import('./side-on-compression.md'),
  },
  {
    id: 'high-angle-three-quarter',
    label: 'High-Angle Three-Quarter',
    file: 'src/lib/prompts/shots/high-angle-three-quarter.md',
    system: () => import('./high-angle-three-quarter.md'),
  },
  {
    id: 'true-overhead',
    label: 'True Overhead',
    file: 'src/lib/prompts/shots/true-overhead.md',
    system: () => import('./true-overhead.md'),
  },
  {
    id: 'rear-three-quarter',
    label: 'Rear Three-Quarter',
    file: 'src/lib/prompts/shots/rear-three-quarter.md',
    system: () => import('./rear-three-quarter.md'),
    needsBack: true,
  },
  {
    id: 'direct-rear-wide',
    label: 'Direct Rear, Wide',
    file: 'src/lib/prompts/shots/direct-rear-wide.md',
    system: () => import('./direct-rear-wide.md'),
    needsBack: true,
  },
  {
    id: 'forced-perspective',
    label: 'Forced Perspective',
    file: 'src/lib/prompts/shots/forced-perspective.md',
    system: () => import('./forced-perspective.md'),
  },
  {
    id: 'extreme-detail',
    label: 'Extreme Detail',
    file: 'src/lib/prompts/shots/extreme-detail.md',
    system: () => import('./extreme-detail.md'),
  },
  {
    id: 'ground-level-base-detail',
    label: 'Ground-Level Base Detail',
    file: 'src/lib/prompts/shots/ground-level-base-detail.md',
    system: () => import('./ground-level-base-detail.md'),
  },
  {
    id: 'wide-establishing',
    label: 'Wide Establishing',
    file: 'src/lib/prompts/shots/wide-establishing.md',
    system: () => import('./wide-establishing.md'),
  },
  {
    id: 'dutch-angle',
    label: 'Dutch Angle',
    file: 'src/lib/prompts/shots/dutch-angle.md',
    system: () => import('./dutch-angle.md'),
  },
  {
    id: 'close-offset-portrait',
    label: 'Close Offset Portrait',
    file: 'src/lib/prompts/shots/close-offset-portrait.md',
    system: () => import('./close-offset-portrait.md'),
  },
  {
    id: 'over-and-behind',
    label: 'Over-and-Behind',
    file: 'src/lib/prompts/shots/over-and-behind.md',
    system: () => import('./over-and-behind.md'),
    needsBack: true,
  },
  {
    id: 'frontal-symmetrical',
    label: 'Frontal Symmetrical',
    file: 'src/lib/prompts/shots/frontal-symmetrical.md',
    system: () => import('./frontal-symmetrical.md'),
  },
] as const

export type ShotId = (typeof SHOTS)[number]['id']

export function findShot(id: string) {
  return SHOTS.find((s) => s.id === id)
}
