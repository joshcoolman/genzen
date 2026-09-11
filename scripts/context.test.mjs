import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  collectMedia,
  describeRun,
  parseActivityUrl,
  readRun,
  sampleVideo,
  validateTarget,
} from './inspect-activity.mjs'
import { findContext, searchOptions } from './find-context.mjs'
import ffmpeg from 'ffmpeg-static'
import { execFileSync } from 'node:child_process'

const id = '988bdedd-e87b-4835-b4d2-3ffc2583e9cc'
const local = { DATABASE_URL: 'postgres://user:pass@localhost/db' }
const dirs = []
async function temp() {
  const directory = await mkdtemp(join(tmpdir(), 'genzen-context-test-'))
  dirs.push(directory)
  return directory
}
afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  )
})

function database(results) {
  const calls = []
  const tx = (strings, ...values) => {
    if (!strings.raw) return { ids: strings }
    const text = strings.join('?')
    if (!/select/i.test(text)) return { fragment: text, values }
    calls.push({ text, values })
    return Promise.resolve(results.shift())
  }
  const begin = vi.fn(async (_mode, fn) => fn(tx))
  return { sql: { begin }, calls }
}

describe('URL and target selection', () => {
  it('accepts absolute, relative, and UUID links without losing entry selection', () => {
    for (const input of [
      id,
      `/activity?entry=${id}`,
      `http://127.0.0.1:3000/activity/?other=1&entry=${id}#prompt`,
    ]) {
      expect(parseActivityUrl(input).id).toBe(id)
    }
    expect(
      parseActivityUrl(`/activity?entry=${id}`, 'https://genzen.example').url
        .origin,
    ).toBe('https://genzen.example')
  })
  it('rejects ambiguous IDs and URLs that do not identify an Activity run', () => {
    for (const url of [
      '/activity',
      '/images',
      '/activity?entry=no',
      `/activity?entry=${id}&entry=${id}`,
      `ftp://localhost/activity?entry=${id}`,
      `http://u:p@localhost/activity?entry=${id}`,
    ]) {
      expect(() => parseActivityUrl(url)).toThrow()
    }
  })
  it('does not silently substitute another environment', () => {
    expect(
      validateTarget(new URL('http://localhost:3000'), local).databaseHost,
    ).toBe('localhost')
    expect(() =>
      validateTarget(new URL('https://genzen.example'), local),
    ).toThrow('APP_URL')
    expect(() =>
      validateTarget(new URL('https://genzen.example'), {
        ...local,
        APP_URL: 'https://genzen.example',
      }),
    ).toThrow('local')
    const remote = {
      DATABASE_URL: 'postgres://u:p@db.example/db',
      APP_URL: 'https://genzen.example',
    }
    expect(validateTarget(new URL(remote.APP_URL), remote).origin).toBe(
      remote.APP_URL,
    )
    expect(() =>
      validateTarget(new URL('http://localhost:3000'), remote),
    ).toThrow('remote')
  })
})

describe('stored context', () => {
  it('preserves source order, deleted refs, missing refs and a video last frame', async () => {
    const { sql, calls } = database([
      [
        {
          id,
          user_id: 'owner',
          source: 'ai_video',
          status: 'failed',
          deleted_at: 'yesterday',
          generation_metadata: {
            source_image_id: 'a',
            reference_image_ids: ['b', 'a', 'missing'],
            end_image_id: 'end',
          },
        },
      ],
      [{ id: 'b', deleted_at: 'yesterday' }, { id: 'a' }, { id: 'end' }],
    ])
    const result = await readRun(sql, id)
    expect(result.references.map((ref) => ref.id)).toEqual([
      'a',
      'b',
      'missing',
      'end',
    ])
    expect(result.references[1].deleted_at).toBe('yesterday')
    expect(result.references[2].missing).toBe(true)
    expect(result.references[3].role).toBe('last frame')
    expect(result.entry.status).toBe('failed')
    expect(calls[1].text).toContain('user_id = ?')
    expect(calls[1].values[0]).toBe('owner')
    expect(sql.begin.mock.calls[0][0]).toContain('read only')
  })
  it('reports an unknown UUID instead of finding another run', async () => {
    const { sql } = database([[]])
    await expect(readRun(sql, id)).rejects.toThrow('not found')
  })
  it('keeps estimate precision, exact sent prompt and errors, including incomplete timing', () => {
    const result = describeRun({
      generation_error: 'recorded error',
      generation_metadata: {
        prompt: 'original',
        sent_prompt: '[Image 1]\noriginal',
        provider_cost_cents: 0.52,
        provider_cost_is_estimate: true,
        submitted_at: '2026-09-10T23:50:55.621Z',
        completed_at: '2026-09-10T23:51:27.670Z',
        error: 'older error',
      },
    })
    expect(result).toMatchObject({
      durationMs: 32049,
      sentPrompt: '[Image 1]\noriginal',
      providerCostCents: 0.52,
      costIsEstimate: true,
      errorMessage: 'recorded error',
    })
    expect(
      describeRun({ generation_metadata: { submitted_at: 'invalid' } })
        .durationMs,
    ).toBeNull()
  })
  it('keeps missing output and download failures explicit, with thumbnail fallback', async () => {
    const directory = await temp()
    const download = vi
      .fn()
      .mockRejectedValueOnce(new Error('storage unavailable'))
      .mockResolvedValueOnce(undefined)
    const result = await collectMedia(
      { storage_path: 'original', thumbnail_path: 'thumb' },
      'output',
      directory,
      download,
    )
    expect(result.path).toBeNull()
    expect(result.previewPath).toContain('thumbnail.webp')
    expect(result.warnings).toHaveLength(1)
    const pending = await collectMedia(
      { status: 'pending' },
      'output',
      directory,
      download,
    )
    expect(pending.warnings[0]).toContain('pending')
    expect(download).toHaveBeenCalledTimes(2)
  })
  it('downloads and samples a real short video', async () => {
    const directory = await temp()
    const fixture = join(directory, 'fixture.mp4')
    execFileSync(ffmpeg, [
      '-loglevel',
      'error',
      '-f',
      'lavfi',
      '-i',
      'color=c=blue:s=160x90:d=1',
      '-pix_fmt',
      'yuv420p',
      fixture,
    ])
    const paths = await sampleVideo(fixture, directory, 'clip')
    expect(paths.length).toBeGreaterThan(0)
    expect(paths.length).toBeLessThanOrEqual(10)
    const frames = vi.fn().mockRejectedValue(new Error('broken codec'))
    const result = await collectMedia(
      { source: 'ai_video', storage_path: 'clip' },
      'video',
      directory,
      async (_key, path) => writeFile(path, 'fixture'),
      frames,
    )
    expect(result.path).toContain('video.mp4')
    expect(result.warnings.join(' ')).toContain('sampling failed')
  })
})

describe('recent media discovery', () => {
  it('validates calendar days, timezones and bounded result sizes', () => {
    expect(searchOptions(['--source', 'uploaded']).source).toBe('upload')
    for (const args of [
      ['--day', '2026-02-30'],
      ['--timezone', 'wrong'],
      ['--limit', '0'],
      ['--limit', '101'],
    ]) {
      expect(() => searchOptions(args)).toThrow()
    }
  })
  it('offers accounts instead of trusting the bootstrap login', async () => {
    const { sql, calls } = database([
      [{ id: 'a' }, { id: 'b' }],
      [{ email: 'actual@example.com', latest_media_at: 'today' }],
    ])
    const result = await findContext(sql, searchOptions([]), {
      ...local,
      LOCAL_DEV_EMAIL: 'bootstrap@example.com',
    })
    expect(result.needsAccount).toBe(true)
    expect(result.accounts[0].email).toBe('actual@example.com')
    expect(calls[0].values).toEqual([])
  })
  it('bounds a selected account query, reports more results, and carries timezone parameters', async () => {
    const { sql, calls } = database([
      [{ id: 'owner', email: 'me@example.com' }],
      [
        { id, source: 'upload', created_at: '2026-09-11T00:30:00Z' },
        { id: 'extra' },
      ],
    ])
    const options = searchOptions([
      '--user',
      'me@example.com',
      '--day',
      '2026-09-10',
      '--timezone',
      'America/New_York',
      '--query',
      '100%_car',
      '--limit',
      '1',
    ])
    const result = await findContext(sql, options, local)
    expect(result.hasMore).toBe(true)
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0].createdAtLocal).toContain('2026-09-10')
    expect(calls[1].values[0]).toBe('owner')
    expect(JSON.stringify(calls[1].values)).toContain('America/New_York')
    expect(JSON.stringify(calls[1].values)).toContain('100\\\\%\\\\_car')
  })
})
