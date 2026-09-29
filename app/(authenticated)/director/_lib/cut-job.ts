import type { PlannedShot } from './rerun'

export interface CutJobShot extends PlannedShot {
  id: string
  duration: number
  spokenOverride: string | null
  state: 'waiting' | 'preparing' | 'submitting' | 'generating' | 'completed'
  frameId?: string
  rejected?: boolean
  requestId?: string
  endpoint?: string
  submittedAt?: string
}

export interface CutJobData {
  direction: string
  source: {
    id: string
    clipIds: Array<string>
    story: string | null
    cast: string | null
    prompts: Array<string>
    allPrompts: Array<string>
  }
  phase: 'cast' | 'plan' | 'pronounce' | 'generate'
  cast: string | null
  story: string | null
  scenes: Array<string>
  shots: Array<CutJobShot>
  seed: number
  index: number
}

export interface CutJob {
  id: string
  session_id: string
  user_id: string
  version: number
  status: 'active' | 'failed' | 'blocked' | 'cancelled' | 'completed'
  data: CutJobData
  error: string | null
}

export type CutProgress = Pick<CutJob, 'id' | 'status' | 'data' | 'error'>

export function cutProgressLabel(job: CutProgress): string {
  if (job.status === 'cancelled')
    return 'Cancelled. Any clip already sent may still finish.'
  if (job.status === 'completed') return 'Cut complete'
  if (job.status === 'blocked') return 'Submission needs checking'
  if (job.status === 'failed') return 'Cut stopped'
  const { phase, shots, index } = job.data
  if (phase === 'cast') return 'Reading the characters and look…'
  if (phase === 'plan') return 'Planning your cut…'
  if (phase === 'pronounce') return 'Preparing pronunciation…'
  const shot = shots.at(index)
  if (!shot) return 'Finishing the cut…'
  return shot.state === 'preparing' && index > 0
    ? `Preparing the handoff for clip ${index + 1} of ${shots.length}`
    : `Generating clip ${index + 1} of ${shots.length}`
}

/** Never let a later completion jump a missing or cancelled position. */
export function completedPrefix(job: CutProgress): Array<string> {
  const ids: Array<string> = []
  for (const shot of job.data.shots) {
    if (shot.state !== 'completed') break
    ids.push(shot.id)
  }
  return ids
}
