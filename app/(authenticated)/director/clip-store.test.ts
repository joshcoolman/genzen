import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { readCut, saveCut } from './clip-store'
import { emptyCut, generationBase } from './clips'

describe('persistent resumable cut', () => {
  it('remembers the selected duration across reloads', async () => {
    const owner = crypto.randomUUID()
    const cut = emptyCut()
    cut.settings.duration = 10
    await saveCut(owner, cut)
    expect((await readCut(owner))?.settings.duration).toBe(10)
  })
  it('defaults old saved settings and pending requests to five seconds', async () => {
    const owner = crypto.randomUUID()
    const cut = emptyCut()
    cut.pending = {
      id: 'old',
      prompt: 'bear',
      context: [],
      settings: { ...cut.settings },
      redo: false,
      startedAt: 0,
    }
    Reflect.deleteProperty(cut.settings, 'duration')
    Reflect.deleteProperty(cut.pending.settings, 'duration')
    await saveCut(owner, cut)
    const restored = await readCut(owner)
    expect(restored?.settings.duration).toBe(5)
    expect(restored?.pending?.settings.duration).toBe(5)
  })
  it('restores media and the ending frame, ready for another section after reload', async () => {
    const owner = crypto.randomUUID()
    const cut = emptyCut()
    cut.clips.push({
      id: 'bear',
      prompt: 'A dancing bear',
      model: 'turbo',
      duration: 5,
      blob: new Blob(['video'], { type: 'video/mp4' }),
      endFrame: new Blob(['ending'], { type: 'image/png' }),
    })
    await saveCut(owner, cut)
    const restored = await readCut(owner)
    expect(await restored!.clips[0].blob.text()).toBe('video')
    expect(await generationBase(restored!, false).image!.text()).toBe('ending')
    expect(await readCut('another-account')).toBeNull()
  })
  it('preserves a pending receipt without replacing the accepted clip', async () => {
    const owner = crypto.randomUUID()
    const cut = emptyCut()
    cut.pending = {
      id: 'job',
      token: 'signed-receipt',
      prompt: 'Add a rabbit',
      context: ['bear'],
      redo: false,
      settings: cut.settings,
      startedAt: 100,
    }
    await saveCut(owner, cut)
    expect((await readCut(owner))?.pending).toEqual(cut.pending)
    await saveCut(owner, emptyCut())
    expect(await readCut(owner)).toEqual(emptyCut())
  })
})
