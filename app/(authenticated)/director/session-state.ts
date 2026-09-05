import { z } from 'zod'
import {
  DEFAULT_CONFIGURATION,
  applyMessage,
  configurationSchema,
  parseMessage,
} from './protocol'
import type { Direction, JournalEvent } from './protocol'

const directionSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  version: z.number().int().positive(),
  status: z.enum(['pending', 'applied', 'rejected', 'failed']),
  submittedAt: z.number(),
  settledAt: z.number().optional(),
  error: z.string().optional(),
})
const journalSchema = z.array(
  z.object({
    at: z.number(),
    session: z.number(),
    message: z.record(z.string(), z.unknown()),
  }),
)
const snapshotSchema = z.object({
  schemaVersion: z.literal(1),
  draft: z.string(),
  configuration: configurationSchema,
  muted: z.boolean(),
  directions: z.array(directionSchema),
  journal: journalSchema,
  version: z.number().int().nonnegative(),
  epoch: z.number().int().nonnegative(),
  initialImageUrl: z.string().nullable(),
  previewId: z.string().nullable(),
})
export type SessionSnapshot = z.infer<typeof snapshotSchema>

export function emptySession(): SessionSnapshot {
  return {
    schemaVersion: 1,
    draft: '',
    configuration: { ...DEFAULT_CONFIGURATION },
    muted: true,
    directions: [],
    journal: [],
    version: 0,
    epoch: 0,
    initialImageUrl: null,
    previewId: null,
  }
}

export function sessionKey(owner: string) {
  return `genzen-director-session-v1-${owner}`
}

/** A restored record is evidence of a past request, never a live connection.
 * Pending requests cannot stay pending forever after a refresh. */
export function recoverSession(snapshot: SessionSnapshot): SessionSnapshot {
  return {
    ...snapshot,
    directions: snapshot.directions.map(
      (entry): Direction =>
        entry.status === 'pending'
          ? {
              ...entry,
              status: 'failed',
              error:
                'Connection interrupted before this direction was confirmed.',
            }
          : entry,
    ),
  }
}

export function readSession(
  storage: Pick<Storage, 'getItem'>,
  owner: string,
): SessionSnapshot | null {
  const raw = storage.getItem(sessionKey(owner))
  if (!raw) return null
  return recoverSession(snapshotSchema.parse(JSON.parse(raw)))
}

export function writeSession(
  storage: Pick<Storage, 'setItem'>,
  owner: string,
  snapshot: SessionSnapshot,
) {
  storage.setItem(sessionKey(owner), JSON.stringify(snapshot))
}

/** Preserve work made before snapshot persistence shipped. The old tab log
 * already recorded opening/replacement prompts, revisions and acknowledgements. */
export function recoverLegacyJournal(
  raw: string | null,
): SessionSnapshot | null {
  if (!raw) return null
  const events: Array<JournalEvent> = journalSchema.parse(JSON.parse(raw))
  const snapshot = emptySession()
  snapshot.journal = events
  for (const event of events) {
    snapshot.epoch = Math.max(snapshot.epoch, event.session)
    const message = event.message
    if (
      (message.type === 'opening' || message.type === 'prompt_sent') &&
      typeof message.prompt === 'string' &&
      typeof message.version === 'number' &&
      typeof message.entryId === 'string'
    ) {
      const entry: Direction = {
        id: message.entryId,
        prompt: message.prompt,
        version: message.version,
        status: 'pending',
        submittedAt: event.at,
      }
      snapshot.directions =
        message.type === 'opening' ? [entry] : [...snapshot.directions, entry]
      snapshot.version = Math.max(snapshot.version, message.version)
      const configuration = configurationSchema.safeParse(message.configuration)
      if (configuration.success) snapshot.configuration = configuration.data
    }
    if (message.type === 'recording_started' && typeof message.id === 'string')
      snapshot.previewId = message.id
    const parsed = parseMessage(JSON.stringify(message))
    if (parsed)
      snapshot.directions = applyMessage(snapshot.directions, parsed, event.at)
  }
  return recoverSession(snapshot)
}
