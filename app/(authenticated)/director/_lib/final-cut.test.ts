import { expect, it } from 'vitest'
import {
  assertFinalSource,
  sampleTimes,
  uncertainWork,
  validatePlan,
} from './final-cut'
import type { FinalPlan } from './final-cut'
import type { SavedExport } from './types'

const source = {
  duration: 10,
  source: [
    { prompt: 'Yellow car', duration: 5 },
    { prompt: 'Tan uniform', duration: 5 },
  ],
} as SavedExport
const plan: FinalPlan = {
  title: 'Chase',
  story: 'A chase',
  continuity: 'Yellow car, tan uniform',
  style: 'Dynamic',
  referenceFrames: [0, 2],
  music: 'Instrumental',
  shots: [
    {
      sections: [0],
      duration: 5,
      prompt: 'Tracking the yellow car',
      sound: 'Engine',
    },
    { sections: [1], duration: 5, prompt: 'Tan uniform', sound: 'Footsteps' },
  ],
}
it('samples only the exported timeline and retains every exported section', () => {
  expect(sampleTimes(source)).toEqual([
    { section: 0, time: 1 },
    { section: 0, time: 3.5 },
    { section: 1, time: 6 },
    { section: 1, time: 8.5 },
  ])
  expect(validatePlan(plan, source, 4)).toEqual(plan)
  expect(() =>
    validatePlan({ ...plan, shots: [plan.shots[0]] }, source, 4),
  ).toThrow('all exported sections')
  expect(() =>
    validatePlan({ ...plan, shots: [...plan.shots].reverse() }, source, 4),
  ).toThrow('in order')
  expect(() =>
    validatePlan({ ...plan, referenceFrames: [4] }, source, 4),
  ).toThrow('unavailable frame')
})
it('bounds cost by source length and shot count before any paid video request', () => {
  expect(() => assertFinalSource({ ...source, duration: 121 })).toThrow(
    '2 minutes',
  )
  expect(() => assertFinalSource({ ...source, source: [] })).toThrow()
  expect(() =>
    validatePlan({ ...plan, shots: [...plan.shots, plan.shots[1]] }, source, 4),
  ).toThrow('budget')
  expect(() =>
    validatePlan({ ...plan, shots: Array(13).fill(plan.shots[0]) }, source, 4),
  ).toThrow()
})
it('never treats a paid intent without a result or receipt as safe to resubmit', () => {
  expect(uncertainWork({})).toBe(false)
  expect(uncertainWork({ planning: true })).toBe(true)
  expect(uncertainWork({ planning: true, plan })).toBe(false)
  expect(uncertainWork({ steps: { shot: { endpoint: 'test' } } })).toBe(true)
  expect(
    uncertainWork({
      steps: { shot: { endpoint: 'test', requestId: 'receipt' } },
    }),
  ).toBe(false)
})
