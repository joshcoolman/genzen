/**
 * What a staged reference is *for* (#635).
 *
 * A picture the model receives is a picture the model draws from, and no
 * sentence in the prompt outweighs pixels -- "image 2 is only for lighting"
 * fails every time because image 2 is still in the request. So a reference
 * carries a role, the way Video's strip carries First frame / Reference / Last
 * frame (#516), and every role but `reference` is **read, not sent**: Claude
 * looks at the picture once, writes what it contributes, and that prose rides
 * with the prompt as a labelled block. The bytes never reach the image model.
 *
 * `reference` is today's behaviour and the default. The read roles:
 *
 * - `lighting` -- the setup as a gaffer would rebuild it, from the prose
 *   Lighting's own derive already writes (`lighting/derive.md`)
 * - `style` -- medium, treatment, palette and grade (`describe/style.md`)
 * - `subject` -- what is in the picture and how it is composed
 *   (`describe/reconstruct.md`)
 *
 * The reading happens when the role is chosen, not at submit, so the text is on
 * screen before anything is spent and lives and dies with the thumbnail.
 */
export const REF_ROLES = [
  { id: 'reference', label: 'Reference', block: null },
  { id: 'lighting', label: 'Lighting', block: 'Lighting' },
  { id: 'style', label: 'Style', block: 'Style' },
  { id: 'subject', label: 'Subject', block: 'Subject' },
] as const

export type RefRole = (typeof REF_ROLES)[number]['id']
export type ReadRole = Exclude<RefRole, 'reference'>

export function isReadRole(role: RefRole | undefined): role is ReadRole {
  return role !== undefined && role !== 'reference'
}

export function isRefRole(value: unknown): value is RefRole {
  return REF_ROLES.some((r) => r.id === value)
}

/** One read role's result, as it travels to the submit and into the row. */
export interface ReferenceReading {
  imageId: string
  role: ReadRole
  text: string
}

/**
 * The blocks appended to a prompt, in strip order. Empty when nothing was read.
 *
 * Labelled and separated by blank lines so the model reads them as standing
 * facts about the picture it is to make, below whatever the user typed. They
 * are data in the prompt rather than instruction: `steering-frame.md` does not
 * apply, and Enhance is told the same if it is ever asked to compact them.
 */
export function readingBlocks(readings: ReadonlyArray<ReferenceReading>) {
  return readings
    .map((reading) => {
      const label = REF_ROLES.find((r) => r.id === reading.role)?.block
      return `${label}:\n${reading.text.trim()}`
    })
    .join('\n\n')
}

/**
 * The user's words followed by the blocks. A typed prompt of nothing and a
 * set of readings is a valid prompt -- "this picture, in this style, lit like
 * this" -- and it is non-empty, which is what keeps the image-only describe
 * fallback in `generate-image-internal` from stacking a description of the
 * reference on top of the blocks.
 */
export function promptWithReadings(
  typed: string,
  readings: ReadonlyArray<ReferenceReading>,
) {
  const blocks = readingBlocks(readings)
  if (!blocks) return typed
  return typed.trim() ? `${typed.trim()}\n\n${blocks}` : blocks
}
