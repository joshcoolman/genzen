import { describe, expect, it } from 'vitest'
import { createWheelStepper } from './use-wheel-step'

describe('createWheelStepper', () => {
  it('steps once per mouse notch and not more', () => {
    const s = createWheelStepper(55, 80)
    // One notch is well over the budget, but it is still one image.
    expect(s.push(100, 0, 0)).toBe(1)
    expect(s.push(100, 0, 200)).toBe(1)
  })

  it('accumulates a trackpad stream into one step', () => {
    const s = createWheelStepper(55, 80)
    let steps = 0
    // Twenty small deltas: 60px total, worth exactly one image -- not twenty.
    for (let i = 0; i < 20; i++) steps += s.push(3, 0, i)
    expect(steps).toBe(1)
  })

  it('rate-limits an inertia tail', () => {
    const s = createWheelStepper(55, 80)
    expect(s.push(100, 0, 0)).toBe(1)
    // Momentum keeps firing full-budget events; inside the interval they are
    // swallowed, or a flick would fly through the whole set.
    expect(s.push(100, 0, 20)).toBe(0)
    expect(s.push(100, 0, 40)).toBe(0)
    expect(s.push(100, 0, 90)).toBe(1)
  })

  it('answers a direction change immediately', () => {
    const s = createWheelStepper(55, 80)
    // Banked most of a step downward, then reversed: the bank is dropped, so
    // the first real push back up is not spent paying it off.
    expect(s.push(50, 0, 0)).toBe(0)
    expect(s.push(-50, 0, 100)).toBe(0)
    expect(s.push(-10, 0, 200)).toBe(-1)
  })

  it('scales line-mode deltas', () => {
    const s = createWheelStepper(55, 80)
    // deltaMode 1 means lines: 4 lines is ~64px, over the budget. Read as
    // pixels it would be 4 and never move at all.
    expect(s.push(4, 1, 0)).toBe(1)
  })
})
