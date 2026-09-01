/**
 * What a captured effect looks like on disk (#562).
 *
 * **Capture writes nothing.** This page derives, tests and names an effect;
 * the thing it hands back is the text of the two edits that would ship it --
 * the `.md` and its entry in `src/lib/prompts/lighting/index.ts`. A lab page
 * that wrote to the repo would be a build step disguised as a button, and one
 * that wrote to a table would be lab state in the database, which this folder
 * does not do. Committing is a commit.
 *
 * Pure and separate from the view so it can be tested without rendering
 * anything: the registry entry is the half that has to be exactly right, and a
 * misquoted gel is a runtime throw in a surface this page never opens.
 */

export interface CapturedEffect {
  id: string
  name: string
  setup: string
  gels: Array<{ token: string; color: string }>
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** The `.md` body. Nothing but the setup: the wrapper is prepended in code and
 *  is identical for every effect, so an effect file never restates it. */
export function effectFileBody(effect: CapturedEffect): string {
  return `${effect.setup.trim()}\n`
}

/** The entry to paste into `LIGHTING_EFFECTS`. Single quotes and trailing
 *  commas because that is what prettier leaves behind, so a paste does not
 *  come back changed by `pnpm check`. */
export function effectRegistryEntry(effect: CapturedEffect): string {
  const gels = effect.gels
    .map((g) => `      ${g.token}: ${quote(g.color)},`)
    .join('\n')
  return [
    '  {',
    `    id: ${quote(effect.id)},`,
    `    label: ${quote(effect.name)},`,
    `    file: 'src/lib/prompts/lighting/${effect.id}.md',`,
    `    system: () => import('./${effect.id}.md'),`,
    '    gels: {',
    gels,
    '    },',
    '  },',
  ].join('\n')
}

function quote(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}
