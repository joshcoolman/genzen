import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DESCRIBE_MODES } from './describe'
import { MULTI_SHOT_PROMPTS, multiShotOptions } from './multi-shot'
import { videoModelBySlug } from '#/features/video/models'

const ROOT = new URL('../../../', import.meta.url).pathname
const PROMPTS = join(ROOT, 'src/lib/prompts')

/**
 * #322. Three of six instructions had been written inline in TypeScript, and
 * the split was not by anything meaningful — it was by what era the feature was
 * written in. These two tests are what stop that drifting back.
 *
 * The point is not tidiness. Someone who wants to see what happens if image
 * variations get weirder should be able to open `image-variation.md`, rewrite a
 * paragraph and run it — no TypeScript, no hunting. That is only true if every
 * instruction is a file whose name says what it steers.
 */
describe('model instructions live in .md files (#322)', () => {
  it('has nothing but markdown in src/lib/prompts', () => {
    // Subfolders are allowed and carry an `index.ts` registry -- a family of
    // prompts one feature switches between (`describe/`) is a folder, so
    // adding one is a file drop. The registry is wiring: labels, the user turn
    // that carries the image, the import. The steering is still only in .md.
    const stray: Array<string> = []
    const walk = (dir: string, prefix: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) {
          walk(full, `${prefix}${entry}/`)
          continue
        }
        if (entry.endsWith('.md')) continue
        if (entry === 'prompts.test.ts') continue
        if (prefix && entry === 'index.ts') continue
        stray.push(prefix + entry)
      }
    }
    walk(PROMPTS, '')
    expect(stray).toEqual([])
  })

  it('has no instruction written inline in a TypeScript file', () => {
    // Deliberately narrow: a long string that addresses the model directly.
    // Short user turns like "Describe this image." are assembly, not steering,
    // and are allowed to stay beside the message they are part of.
    const offenders: Array<string> = []
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        if (entry === 'node_modules' || entry.startsWith('.')) continue
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) {
          walk(full)
          continue
        }
        if (!/\.tsx?$/.test(full)) continue
        const text = readFileSync(full, 'utf8')
        for (const m of text.matchAll(/`([^`]{200,})`/g)) {
          if (/\bYou are\b|\bYour job is\b/.test(m[1])) {
            offenders.push(full.slice(ROOT.length))
          }
        }
      }
    }
    walk(join(ROOT, 'src'))
    walk(join(ROOT, 'app'))
    expect(offenders).toEqual([])
  })
})

describe('describe registry', () => {
  it('loads real prose for every mode, and names a file that exists', async () => {
    for (const mode of DESCRIBE_MODES) {
      const { default: system } = await mode.system()
      expect(system.length, mode.id).toBeGreaterThan(100)
      expect(readFileSync(join(ROOT, mode.file), 'utf8')).toBe(system)
    }
  })
})

describe('multi-shot registry', () => {
  it('loads real prose for every writer, and names a file that exists', async () => {
    for (const writer of MULTI_SHOT_PROMPTS) {
      const { default: system } = await writer.system()
      expect(system.length, writer.id).toBeGreaterThan(100)
      expect(readFileSync(join(ROOT, writer.file), 'utf8')).toBe(system)
    }
  })

  it('points every writer at a video model that exists', () => {
    // The controls derive from this record. A slug that resolves to nothing
    // would leave the lab with no durations to offer and no way to say why.
    for (const writer of MULTI_SHOT_PROMPTS) {
      expect(videoModelBySlug(writer.videoModelSlug), writer.id).toBeDefined()
    }
  })

  it("offers only lengths and shapes the writer's own model accepts", () => {
    // The whole reason the options come off the lineup (#522): a script timed
    // to 20s for a model whose ceiling is 15 reads fine and fails at FAL, long
    // after the words looked right.
    for (const writer of MULTI_SHOT_PROMPTS) {
      const options = multiShotOptions(writer.id)!
      const model = videoModelBySlug(writer.videoModelSlug)!
      expect(options.durations, writer.id).toEqual(model.durations)
      expect(options.durations, writer.id).toContain(options.defaultDuration)
      // Text-to-video ratios, so `auto` -- which needs an image to match -- is
      // never offered.
      expect(options.aspectRatios, writer.id).not.toContain('auto')
      expect(options.aspectRatios.length, writer.id).toBeGreaterThan(0)
    }
  })

  it('documents a split for every duration its model offers', () => {
    // The instruction hands the model a fixed split per length because the
    // arithmetic is where it fails. A duration the control can select but the
    // table does not list sends it back to working it out as it goes.
    const md = readFileSync(
      join(ROOT, 'src/lib/prompts/multi-shot/minimax-h3.md'),
      'utf8',
    )
    for (const seconds of multiShotOptions('minimax-h3')!.durations) {
      expect(md, `${seconds}s split`).toContain(`- ${seconds}s -- `)
    }
  })

  it('has no writer id colliding with the image target', () => {
    // `IMAGE_TARGET` shares the target dropdown with these ids.
    expect(MULTI_SHOT_PROMPTS.map((p) => p.id)).not.toContain('image')
  })
})
