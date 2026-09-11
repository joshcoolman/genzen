import { describe, expect, it } from 'vitest'
import { pixelRegion, validateFrames } from './frame-extraction'

const frame = {
  id: '11111111-1111-4111-8111-111111111111',
  label: 'First',
  left: 0,
  top: 0,
  width: 100,
  height: 50,
}
describe('reviewed frame boundaries', () => {
  it('maps normalized coordinates to the original resolution with shared edges', () => {
    const first = pixelRegion(
      { left: 0, top: 0, right: 500, bottom: 1000 },
      2049,
      1152,
    )
    const second = pixelRegion(
      { left: 500, top: 0, right: 1000, bottom: 1000 },
      2049,
      1152,
    )
    expect(first.width).toBe(second.left)
    expect(first.width + second.width).toBe(2049)
    expect(second.height).toBe(1152)
  })
  it('accepts the full image and overlapping inset frames, but rejects duplicate regions', () => {
    expect(validateFrames([frame], 100, 50)).toEqual([frame])
    const inset = { ...frame, id: crypto.randomUUID(), left: 10, width: 20 }
    expect(validateFrames([frame, inset], 100, 50)).toHaveLength(2)
    expect(() =>
      validateFrames([frame, { ...frame, id: crypto.randomUUID() }], 100, 50),
    ).toThrow('same boundary')
  })
  it.each([
    { left: -1 },
    { width: 0 },
    { height: 51 },
    { left: 1 },
    { width: 1.5 },
  ])('rejects invalid crops %j', (patch) => {
    expect(() => validateFrames([{ ...frame, ...patch }], 100, 50)).toThrow()
  })
  it('rejects empty, excessive and repeated identities', () => {
    expect(() => validateFrames([], 100, 50)).toThrow()
    expect(() =>
      validateFrames(
        Array.from({ length: 33 }, () => ({
          ...frame,
          id: crypto.randomUUID(),
        })),
        100,
        50,
      ),
    ).toThrow()
    expect(() =>
      validateFrames([frame, { ...frame, width: 90 }], 100, 50),
    ).toThrow('unique identity')
  })
})
