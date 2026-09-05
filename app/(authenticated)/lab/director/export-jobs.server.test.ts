import { access, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  appendExport,
  createExport,
  finishExport,
  removeExport,
} from './export-jobs.server'

const mocks = vi.hoisted(() => ({ stitch: vi.fn() }))
vi.mock('./stitch-silent.server', () => ({ stitchSilent: mocks.stitch }))
afterEach(() => vi.resetAllMocks())
describe('temporary export ownership and cleanup', () => {
  it('requires complete ordered uploads and cleans files after download', async () => {
    const owner = crypto.randomUUID()
    const id = await createExport(owner, [{ size: 3, duration: 5 }])
    let dir = ''
    try {
      await expect(
        appendExport('other', id, 0, 0, new Uint8Array([1])),
      ).rejects.toThrow('unavailable')
      await expect(
        appendExport(owner, id, 0, 1, new Uint8Array([1])),
      ).rejects.toThrow('out-of-order')
      await expect(finishExport(owner, id)).rejects.toThrow('not finished')
      await appendExport(owner, id, 0, 0, new Uint8Array([1, 2]))
      await appendExport(owner, id, 0, 2, new Uint8Array([3]))
      mocks.stitch.mockImplementation(async (path: string) => {
        dir = path
        expect([...(await readFile(join(path, 'source-0')))]).toEqual([1, 2, 3])
        await writeFile(join(path, 'final.mp4'), 'result')
        return join(path, 'final.mp4')
      })
      expect(new TextDecoder().decode(await finishExport(owner, id))).toBe(
        'result',
      )
      await expect(access(dir)).rejects.toThrow()
    } finally {
      await removeExport(owner, id).catch(() => {})
    }
  })
  it('removes temporary media on encoding failure and permits a new export', async () => {
    const owner = crypto.randomUUID()
    const id = await createExport(owner, [{ size: 1, duration: 5 }])
    await appendExport(owner, id, 0, 0, new Uint8Array([1]))
    let dir = ''
    mocks.stitch.mockImplementation((path: string) => {
      dir = path
      throw new Error('encode failed')
    })
    await expect(finishExport(owner, id)).rejects.toThrow('encode failed')
    await expect(access(dir)).rejects.toThrow()
    const next = await createExport(owner, [{ size: 1, duration: 5 }])
    await removeExport(owner, next)
  })
})
