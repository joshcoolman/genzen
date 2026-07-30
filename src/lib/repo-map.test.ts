import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// The README's `## Repo map` and the root `CLAUDE.md` feature table both name
// paths, and nothing forces either to stay true. A doc that lists files goes
// stale silently -- `src/features/ai-images/CLAUDE.md` listed two server files
// deleted in 2b567fc and missed two that existed, and nothing noticed for months.
//
// The pre-commit hook (`scripts/check-claude-md.mjs`) warns when a folder's shape
// changes without its CLAUDE.md; this is the other half, and the half that
// actually fails: every path a doc claims must exist, and every feature must
// carry the CLAUDE.md the docs promise a reader will find. Text in, sets
// compared, no services -- same approach as `user-image-columns.server.test.ts`.

const ROOT = new URL('../../', import.meta.url)
const read = (p: string) => readFileSync(new URL(p, ROOT), 'utf8')
const exists = (p: string) => existsSync(new URL(p, ROOT))

/** First-column backticked paths from a markdown table, minus the header rule. */
function tablePaths(markdown: string, heading: string): Array<string> {
  const section = markdown.split(`## ${heading}`)[1] ?? ''
  const table = section.split(/\n(?=## )/)[0]
  return table
    .split('\n')
    .filter((line) => line.trimStart().startsWith('|'))
    .map((line) => /`([^`]+)`/.exec(line.split('|')[1] ?? '')?.[1])
    .filter((p): p is string => Boolean(p))
}

const featureDirs = readdirSync(new URL('src/features/', ROOT), {
  withFileTypes: true,
})
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort()

describe('README ## Repo map', () => {
  const claimed = tablePaths(read('README.md'), 'Repo map')

  it('names at least the paths a reader needs to orient', () => {
    expect(claimed.length).toBeGreaterThan(4)
  })

  it.each(claimed)('%s exists', (path) => {
    // `<name>` is a placeholder for any child, e.g. `src/features/<name>/`.
    if (path.includes('<')) {
      const parent = path.slice(0, path.indexOf('<'))
      expect(exists(parent), `${parent} (parent of ${path})`).toBe(true)
      expect(
        readdirSync(new URL(parent, ROOT)).length,
        `${path} matches nothing`,
      ).toBeGreaterThan(0)
      return
    }
    expect(
      exists(path),
      `README ## Repo map names ${path}, which is missing`,
    ).toBe(true)
  })
})

describe('the CLAUDE.md promise', () => {
  // Both the README repo map and the root CLAUDE.md tell a reader that every
  // feature has one to read before editing. A feature without one breaks that
  // silently -- the reader finds nothing and assumes there was nothing to know.
  it.each(featureDirs)('src/features/%s has a CLAUDE.md', (dir) => {
    expect(exists(`src/features/${dir}/CLAUDE.md`)).toBe(true)
  })

  it('the root CLAUDE.md feature table matches the folders on disk', () => {
    const body = read('CLAUDE.md')
    const listed = featureDirs.filter((dir) =>
      body.includes(`src/features/${dir}/CLAUDE.md`),
    )
    expect(listed).toEqual(featureDirs)
  })
})
