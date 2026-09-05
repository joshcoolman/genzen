import { expect, it } from 'vitest'
import {
  assertFinalSource,
  rejectedWork,
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
  shots: [
    {
      sections: [0],
      duration: 5,
      prompt: 'Tracking the yellow car',
    },
    { sections: [1], duration: 5, prompt: 'Tan uniform' },
  ],
}
it('samples only the exported timeline and permits selective coverage in story order', () => {
  expect(sampleTimes(source)).toEqual([
    { section: 0, time: 1 },
    { section: 0, time: 3.5 },
    { section: 1, time: 6 },
    { section: 1, time: 8.5 },
  ])
  expect(validatePlan(plan, source, 4)).toEqual(plan)
  expect(
    validatePlan({ ...plan, shots: [plan.shots[0]] }, source, 4).shots,
  ).toHaveLength(1)
  expect(() =>
    validatePlan({ ...plan, shots: [...plan.shots].reverse() }, source, 4),
  ).toThrow('story order')
  expect(() =>
    validatePlan(
      { ...plan, shots: [{ ...plan.shots[0], sections: [2] }] },
      source,
      4,
    ),
  ).toThrow('existing exported sections')
  expect(() =>
    validatePlan({ ...plan, referenceFrames: [4] }, source, 4),
  ).toThrow('unavailable frame')
})
it('bounds cost by source length and shot count before any paid video request', () => {
  expect(() => assertFinalSource({ ...source, duration: 167 })).not.toThrow()
  expect(() => assertFinalSource({ ...source, duration: 181 })).toThrow(
    '3 minutes',
  )
  expect(() => assertFinalSource({ ...source, source: [] })).toThrow()
  expect(() =>
    validatePlan({ ...plan, shots: [...plan.shots, plan.shots[1]] }, source, 4),
  ).toThrow('fewer shots')
  expect(() =>
    validatePlan({ ...plan, shots: Array(13).fill(plan.shots[0]) }, source, 4),
  ).toThrow()
})
it('fits an overlong treatment into two minutes without rejecting it or changing its selected story', () => {
  const rough = { ...source, duration: 167 }
  const shots = Array.from({ length: 12 }, (_, index) => ({
    ...plan.shots[index < 6 ? 0 : 1],
    duration: 15 as const,
  }))
  const fitted = validatePlan({ ...plan, shots }, rough, 4)
  expect(fitted.shots.reduce((sum, shot) => sum + shot.duration, 0)).toBe(120)
  expect(fitted.shots.map((shot) => shot.sections)).toEqual(
    shots.map((shot) => shot.sections),
  )
  expect(shots.map((shot) => shot.duration)).toEqual(Array(12).fill(15))
  const short = validatePlan(
    { ...plan, shots: plan.shots.map((shot) => ({ ...shot, duration: 15 })) },
    source,
    4,
  )
  expect(short.shots.map((shot) => shot.duration)).toEqual([5, 5])
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
it('ignores retired audio steps without discarding their receipts or weakening picture safety', () => {
  const work = {
    steps: {
      'effects-0': { endpoint: 'fal-ai/mmaudio-v2' },
      music: {
        endpoint: 'fal-ai/stable-audio-25/text-to-audio',
        terminal: true,
      },
    },
  }
  expect(uncertainWork(work)).toBe(false)
  expect(rejectedWork(work)).toBe(false)
  expect(Object.keys(work.steps)).toEqual(['effects-0', 'music'])
  expect(
    uncertainWork({
      steps: { ...work.steps, 'picture-0': { endpoint: 'video' } },
    }),
  ).toBe(true)
  expect(
    rejectedWork({
      steps: {
        ...work.steps,
        'picture-0': { endpoint: 'video', terminal: true },
      },
    }),
  ).toBe(true)
})
