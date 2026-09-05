import { z } from 'zod'

export const ENDPOINT = 'minimax/h3-max/director'
export const SESSION_SECONDS = 120
export const MAX_PROMPT_LENGTH = 50_000

export const configurationSchema = z.object({
  aspect_ratio: z.enum(['16:9', '9:16', '1:1']),
  resolution: z.enum(['480p', '768p']),
  memory: z.number().int().min(1).max(50),
})
export type Configuration = z.infer<typeof configurationSchema>
export const DEFAULT_CONFIGURATION: Configuration = {
  aspect_ratio: '16:9',
  resolution: '480p',
  memory: 12,
}

export type DirectionStatus = 'pending' | 'applied' | 'rejected' | 'failed'
export interface Direction {
  id: string
  prompt: string
  version: number
  status: DirectionStatus
  submittedAt: number
  settledAt?: number
  error?: string
}
export interface JournalEvent {
  at: number
  session: number
  message: Record<string, unknown>
}

const version = z.number().int().positive()
const index = z.number().int().nonnegative()
export const messageSchema = z.discriminatedUnion('type', [
  z
    .object({ type: z.literal('configured'), prompt_version: version })
    .passthrough(),
  z
    .object({ type: z.literal('prompt_pending'), prompt_version: version })
    .passthrough(),
  z
    .object({ type: z.literal('prompt_applied'), prompt_version: version })
    .passthrough(),
  z
    .object({
      type: z.literal('prompt_rejected'),
      prompt_version: version,
      reason: z.string(),
    })
    .passthrough(),
  z
    .object({
      type: z.literal('error'),
      prompt_version: version.nullish(),
      error: z.string(),
      code: z.string(),
    })
    .passthrough(),
  z
    .object({
      type: z.literal('chunk'),
      chunk_index: index,
      prompt_version: version,
      playback_seconds: z.number().positive(),
      buffer_depth_seconds: z.number().nonnegative(),
    })
    .passthrough(),
  z
    .object({ type: z.literal('deadline_missed'), chunk_index: index })
    .passthrough(),
  z
    .object({ type: z.literal('stream_exhausted'), reason: z.string() })
    .passthrough(),
  z.object({ type: z.literal('session_info') }).passthrough(),
  z.object({ type: z.literal('session_metrics') }).passthrough(),
  z.object({ type: z.literal('chunk_metrics') }).passthrough(),
  z.object({ type: z.literal('pong') }).passthrough(),
])
export type ServerMessage = z.infer<typeof messageSchema>

export function parseMessage(raw: string): ServerMessage | null {
  try {
    const result = messageSchema.safeParse(JSON.parse(raw))
    return result.success ? result.data : null
  } catch {
    return null
  }
}

/** Only a matching live revision can change a visible row. Provider versions
 * never double as list positions: redo #1 can be provider version 7. */
export function applyMessage(
  directions: Array<Direction>,
  message: ServerMessage,
  at: number,
): Array<Direction> {
  if (!('prompt_version' in message)) return directions
  return directions.map((entry) => {
    if (entry.version !== message.prompt_version) return entry
    if (message.type === 'prompt_pending') return entry
    if (entry.status !== 'pending') return entry
    if (message.type === 'configured' || message.type === 'prompt_applied') {
      return { ...entry, status: 'applied', settledAt: at }
    }
    if (message.type === 'prompt_rejected' || message.type === 'error') {
      return {
        ...entry,
        status: message.type === 'prompt_rejected' ? 'rejected' : 'failed',
        settledAt: at,
        error: message.type === 'error' ? message.error : message.reason,
      }
    }
    return entry
  })
}

export function submitDirection(
  directions: Array<Direction>,
  prompt: string,
  versionNumber: number,
  redo: boolean,
  at: number,
  id: string,
): Array<Direction> {
  const text = prompt.trim()
  if (!text || text.length > MAX_PROMPT_LENGTH)
    throw new Error('Enter a direction of 1–50,000 characters.')
  if (redo && directions.length !== 1) {
    throw new Error(
      'Redo after a continuation needs provider context restoration, which is not yet available.',
    )
  }
  const entry: Direction = {
    id: redo ? directions[0].id : id,
    prompt: text,
    version: versionNumber,
    status: 'pending',
    submittedAt: at,
  }
  return redo ? [entry] : [...directions, entry]
}
