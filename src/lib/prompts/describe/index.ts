/**
 * The describe modes, in the order the lab lists them.
 *
 * Adding a mode is a file plus an entry here -- nothing else. The type, the
 * lab's select, the instruction-file link and the system/user pair a run sends
 * are all derived from this array, because each of those used to be its own
 * hard-coded list and a third prompt meant editing four files.
 *
 * `system` is loaded, not imported, on purpose: the lab's `use-view.ts` is a
 * client module and reads this array for its labels, and a static import would
 * put every mode's prompt text in the browser bundle. The dynamic import keeps
 * the markdown in a chunk only the server ever asks for.
 *
 * The prose itself stays in the `.md` beside this file (#322). `userText` is
 * the one-line turn that carries the image -- assembly, not steering, so it
 * would be a file nobody ever opened to change a result.
 */
export const DESCRIBE_MODES = [
  {
    id: 'reconstruct',
    label: 'Reconstruct',
    // Writes a prompt meant to regenerate the picture.
    file: 'src/lib/prompts/describe/reconstruct.md',
    userText: 'Write an image generation prompt for this image.',
    system: () => import('./reconstruct.md'),
  },
  {
    id: 'anchor',
    label: 'Anchor',
    // Writes a short factual description meant to steer an image-to-image run.
    file: 'src/lib/prompts/describe/anchor.md',
    userText: 'Describe this image.',
    system: () => import('./anchor.md'),
  },
] as const

export type DescribeMode = (typeof DESCRIBE_MODES)[number]['id']

/** What `generate-image-internal` sends when an image arrives with no prompt. */
export const DEFAULT_DESCRIBE_MODE: DescribeMode = 'anchor'

export function describeMode(id: DescribeMode) {
  const mode = DESCRIBE_MODES.find((m) => m.id === id)
  if (!mode) throw new Error(`Unknown describe mode: ${id}`)
  return mode
}
