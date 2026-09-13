import { describe, expect, it, vi } from 'vitest'
import { CutPlayback } from './playback'

class Video extends EventTarget {
  src = ''
  currentTime = 0
  duration = 5
  readyState = 4
  seeking = false
  muted = false
  onended: (() => void) | null = null
  onerror: (() => void) | null = null
  pause = vi.fn()
  play = vi.fn(() => Promise.resolve())
  load = vi.fn()
  getAttribute() {
    return this.src
  }
  removeAttribute() {
    this.src = ''
  }
}
const clip = (id: string) => ({ id, url: `blob:${id}` })
function setup() {
  const a = new Video()
  const b = new Video()
  const changed = vi.fn()
  const failed = vi.fn()
  const engine = new CutPlayback(
    [a, b] as unknown as [HTMLVideoElement, HTMLVideoElement],
    changed,
    failed,
  )
  return { a, b, changed, failed, engine }
}

describe('growing silent playback', () => {
  it('appends halfway through A without seeking or reloading A; then plays B and loops to A', () => {
    const { a, b, engine, changed } = setup()
    engine.setClips([clip('a')])
    b.currentTime = 2.5
    const loads = b.load.mock.calls.length
    engine.setClips([clip('a'), clip('b')])
    expect(b.currentTime).toBe(2.5)
    expect(b.load).toHaveBeenCalledTimes(loads)
    expect(a.src).toBe('blob:b')
    b.onended?.()
    expect(changed).toHaveBeenLastCalledWith(0, 1, false)
    expect(a.play).toHaveBeenCalled()
    a.onended?.()
    b.dispatchEvent(new Event('seeked'))
    expect(changed).toHaveBeenLastCalledWith(1, 0, false)
    expect(a.muted && b.muted).toBe(true)
  })
  it('loops a single clip and never mutates it when a replacement arrives', () => {
    const { a, b, engine, changed } = setup()
    engine.setClips([clip('a')])
    b.currentTime = 3
    engine.setClips([clip('redo-a')])
    expect(b.src).toBe('blob:a')
    expect(b.currentTime).toBe(3)
    b.onended?.()
    expect(a.src).toBe('blob:redo-a')
    expect(changed).toHaveBeenLastCalledWith(0, 0, false)
    a.onended?.()
    b.dispatchEvent(new Event('seeked'))
    expect(b.src).toBe('blob:redo-a')
    expect(changed).toHaveBeenLastCalledWith(1, 0, false)
  })
  it('jumps to the tail of clip 5 to inspect the 5→6 join', () => {
    const { a, b, engine, changed } = setup()
    engine.setClips(['1', '2', '3', '4', '5', '6'].map(clip))
    engine.latest()
    expect(a.src).toBe('blob:5')
    expect(a.currentTime).toBe(3)
    a.dispatchEvent(new Event('seeked'))
    expect(changed).toHaveBeenLastCalledWith(0, 4, false)
    expect(b.src).toBe('blob:6')
    a.onended?.()
    expect(changed).toHaveBeenLastCalledWith(1, 5, false)
  })
  it('keeps the old frame visible until the next clip is ready', () => {
    const { a, b, engine, changed } = setup()
    engine.setClips([clip('a'), clip('b')])
    a.readyState = 1
    b.onended?.()
    expect(changed).toHaveBeenLastCalledWith(1, 0, false)
    a.readyState = 4
    a.dispatchEvent(new Event('canplay'))
    expect(changed).toHaveBeenLastCalledWith(0, 1, false)
    engine.dispose()
    expect(a.src).toBe('')
    expect(b.src).toBe('')
  })
  it('jumps to a section paused, then toggles that section without restarting it', () => {
    const { a, b, engine, changed } = setup()
    engine.setClips(['1', '2', '3'].map(clip))
    b.play.mockClear()
    engine.jump(2)
    expect(a.src).toBe('blob:3')
    expect(a.currentTime).toBe(0)
    a.dispatchEvent(new Event('canplay'))
    expect(changed).toHaveBeenLastCalledWith(0, 2, true)
    expect(a.play).not.toHaveBeenCalled()
    a.currentTime = 2.5
    engine.toggle()
    expect(a.currentTime).toBe(2.5)
    expect(a.play).toHaveBeenCalled()
    expect(changed).toHaveBeenLastCalledWith(0, 2, false)
  })
})
