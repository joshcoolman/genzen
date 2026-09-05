import { afterEach, describe, expect, it, vi } from 'vitest'
import { TakeRecorder } from './recording'
import type { SavedTake } from './recording'

class FakeRecorder extends EventTarget {
  static isTypeSupported = () => true
  static latest: FakeRecorder
  mimeType = 'video/webm'
  state = 'inactive'
  ondataavailable?: (event: { data: Blob }) => void
  onerror?: () => void
  constructor(public stream: MediaStream) {
    super()
    FakeRecorder.latest = this
  }
  start() {
    this.state = 'recording'
  }
  chunk(text: string) {
    this.ondataavailable?.({ data: new Blob([text]) })
  }
  stop() {
    this.state = 'inactive'
    queueMicrotask(() => {
      this.chunk('final')
      this.dispatchEvent(new Event('stop'))
    })
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('received stream recording', () => {
  it('waits for the final data event and checkpoints it after earlier chunks', async () => {
    vi.stubGlobal('MediaRecorder', FakeRecorder)
    const saved: Array<SavedTake> = []
    const input = {} as MediaStream
    const recorder = new TakeRecorder(input, vi.fn(), async (take) => {
      saved.push(take)
    })
    expect(FakeRecorder.latest.stream).toBe(input)
    FakeRecorder.latest.chunk('first')
    const firstStop = recorder.stop()
    expect(recorder.stop()).toBe(firstStop)
    const result = await firstStop
    expect(await result.blob.text()).toBe('firstfinal')
    expect(saved.at(-1)?.complete).toBe(true)
    expect(await saved.at(-1)?.blob.text()).toBe('firstfinal')
  })

  it('returns captured bytes even when local persistence fails', async () => {
    vi.stubGlobal('MediaRecorder', FakeRecorder)
    const onError = vi.fn()
    const recorder = new TakeRecorder({} as MediaStream, onError, async () => {
      throw new Error('quota')
    })
    const result = await recorder.stop()
    expect(result.blob.size).toBeGreaterThan(0)
    expect(onError).toHaveBeenCalled()
  })
})
