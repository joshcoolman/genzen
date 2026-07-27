// Enumerated rather than globbed: Turbopack resolves imports statically, so a
// new skill file means a line here. Four skills; the explicitness is cheap and
// the failure mode (a skill silently missing from the index) is not.
import characterReferenceSheet from '#/lib/prompts/skills/character-reference-sheet.md'
import enhancePrompt from '#/lib/prompts/skills/enhance-prompt.md'
import imagePrompting from '#/lib/prompts/skills/image-prompting.md'
import videoSceneComposition from '#/lib/prompts/skills/video-scene-composition.md'

export interface Skill {
  name: string
  description: string
  body: string
  /** User-facing chip label (title case). Defaults to prettified `name`. */
  label: string
  /** Natural-language intent injected as a user message when the chip is clicked. */
  launch: string
}

function prettifyName(name: string): string {
  return name
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

const skillModules: Record<string, string> = {
  '/src/lib/prompts/skills/character-reference-sheet.md':
    characterReferenceSheet,
  '/src/lib/prompts/skills/enhance-prompt.md': enhancePrompt,
  '/src/lib/prompts/skills/image-prompting.md': imagePrompting,
  '/src/lib/prompts/skills/video-scene-composition.md': videoSceneComposition,
}

// Minimal frontmatter parser — browser-safe (gray-matter needs Node's Buffer).
// Skills only use simple `key: value` string fields, so full YAML is overkill.
function parseFrontmatter(raw: string): {
  data: Record<string, string>
  content: string
} {
  if (!raw.startsWith('---')) return { data: {}, content: raw }
  const end = raw.indexOf('\n---', 3)
  if (end === -1) return { data: {}, content: raw }
  const header = raw.slice(3, end).trim()
  const body = raw.slice(end + 4).replace(/^\r?\n/, '')
  const data: Record<string, string> = {}
  for (const line of header.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
    if (!match) continue
    let value = match[2].trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    data[match[1]] = value
  }
  return { data, content: body }
}

function parseSkill(raw: string, filePath: string): Skill | null {
  const { data, content } = parseFrontmatter(raw)
  const name = (data.name || '').trim()
  const description = (data.description || '').trim()
  if (!name || !description) {
    console.warn(
      `[ad/skills] ${filePath} is missing required frontmatter (name, description) — skipping`,
    )
    return null
  }
  const label = (data.label || '').trim() || prettifyName(name)
  const launch =
    (data.launch || '').trim() || `Let's work with the ${label} skill.`
  return { name, description, body: content.trim(), label, launch }
}

const parsed: Array<Skill> = Object.entries(skillModules)
  .map(([path, raw]) => parseSkill(raw, path))
  .filter((s): s is Skill => s !== null)
  .sort((a, b) => a.name.localeCompare(b.name))

const byName = new Map(parsed.map((s) => [s.name, s]))

export const skills: ReadonlyArray<Skill> = parsed

export function getSkill(name: string): Skill | undefined {
  return byName.get(name)
}

/** Short markdown-formatted index of name — description pairs for the system prompt. */
export function buildSkillsIndex(): string {
  if (parsed.length === 0) return ''
  const lines = parsed.map((s) => `- \`${s.name}\` — ${s.description}`)
  return [
    '## Available Skills',
    "You have a library of skills. Each skill is a detailed recipe for a specific situation. **Before composing a prompt card, if any skill description matches the user's intent, you MUST call `load_skill({name})` first and let the skill body inform your answer.** Loaded skills persist for the rest of the turn — do not reload.",
    '',
    ...lines,
  ].join('\n')
}
