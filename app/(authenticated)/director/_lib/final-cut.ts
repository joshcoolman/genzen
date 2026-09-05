import { z } from 'zod'
import type { SavedExport } from './types'

export const FINAL_CUT_SECONDS = 120
export const planSchema = z.object({
  title: z.string().min(1).max(120),
  story: z.string().min(1).max(4000),
  continuity: z.string().min(1).max(4000),
  style: z.string().min(1).max(2000),
  referenceFrames: z.array(z.number().int().min(0)).min(1).max(6),
  music: z.string().min(1).max(2000),
  shots: z
    .array(
      z.object({
        sections: z.array(z.number().int().min(0)).min(1).max(50),
        duration: z.union([z.literal(5), z.literal(10), z.literal(15)]),
        prompt: z.string().min(1).max(4000),
        sound: z.string().min(1).max(2000),
      }),
    )
    .min(1)
    .max(12),
})
export type FinalPlan = z.infer<typeof planSchema>
export type FinalOutput = {
  mediaId: string
  thumbnailId: string
  endFrameId: string
  duration: number
}
export type FinalStep = {
  endpoint: string
  input?: Record<string, unknown>
  requestId?: string
  url?: string
  mediaId?: string
  terminal?: boolean
}
export type FinalWork = {
  planning?: boolean
  plan?: FinalPlan
  frames?: Array<{ mediaId: string; time: number; section: number }>
  references?: Array<string>
  steps?: Partial<Record<string, FinalStep>>
}
export type FinalCut = {
  id: string
  session_id: string
  export_id: string
  status: 'queued' | 'running' | 'failed' | 'complete' | 'cancelled'
  stage: string
  error: string | null
  work: FinalWork
  output: FinalOutput | null
  lease_id: string | null
  lease_until: Date | null
  created_at: string
}
export type FinalCutSummary = Pick<
  FinalCut,
  'id' | 'export_id' | 'status' | 'stage' | 'error' | 'output' | 'created_at'
> & { name: string; resumable: boolean; occupied: boolean }

export function uncertainWork(work: FinalWork) {
  return (
    (!!work.planning && !work.plan) ||
    Object.values(work.steps ?? {}).some((step) => step && !step.requestId)
  )
}
export function rejectedWork(work: FinalWork) {
  return Object.values(work.steps ?? {}).some((step) => step?.terminal)
}
export function finalCutSummary(item: FinalCut): FinalCutSummary {
  return {
    id: item.id,
    export_id: item.export_id,
    status: item.status,
    stage: item.stage,
    error: item.error,
    output: item.output,
    created_at: item.created_at,
    name: item.work.plan?.title ?? 'Final Cut',
    resumable:
      item.status === 'failed' &&
      !uncertainWork(item.work) &&
      !rejectedWork(item.work),
    occupied:
      item.status === 'queued' ||
      item.status === 'running' ||
      !!(item.lease_until && new Date(item.lease_until).getTime() > Date.now()),
  }
}
export function assertFinalSource(source: SavedExport) {
  if (
    !Number.isFinite(source.duration) ||
    source.duration <= 0 ||
    source.duration > FINAL_CUT_SECONDS ||
    !source.source.length ||
    source.source.length > 50
  )
    throw new Error(
      'Final Cut currently supports exports up to 2 minutes and 50 sections.',
    )
}
export function validatePlan(
  value: unknown,
  source: SavedExport,
  frameCount: number,
) {
  assertFinalSource(source)
  const plan = planSchema.parse(value)
  const budget = Math.min(FINAL_CUT_SECONDS, Math.ceil(source.duration / 5) * 5)
  if (plan.shots.reduce((sum, shot) => sum + shot.duration, 0) > budget)
    throw new Error(
      'The proposed treatment exceeds the export duration budget.',
    )
  if (plan.referenceFrames.some((index) => index >= frameCount))
    throw new Error('The treatment references an unavailable frame.')
  const sections = plan.shots.flatMap((shot) => shot.sections)
  if (
    sections.some(
      (section, index) =>
        section >= source.source.length ||
        (index > 0 && section < sections[index - 1]),
    ) ||
    new Set(sections).size !== source.source.length
  )
    throw new Error(
      'The treatment must preserve all exported sections in order.',
    )
  return plan
}

export function sampleTimes(source: SavedExport) {
  assertFinalSource(source)
  const total = source.source.reduce((sum, clip) => sum + clip.duration, 0)
  let start = 0
  return source.source.flatMap((clip, section) => {
    const points = source.source.length <= 16 ? [0.2, 0.7] : [0.5]
    const samples = points.map((point) => ({
      section,
      time: ((start + clip.duration * point) / total) * source.duration,
    }))
    start += clip.duration
    return samples
  })
}
