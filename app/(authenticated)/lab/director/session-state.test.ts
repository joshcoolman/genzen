import { describe, expect, it } from 'vitest'
import {
  emptySession,
  readSession,
  recoverLegacyJournal,
  writeSession,
} from './session-state'

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
  }
}

describe('local session recovery', () => {
  it('restores draft, settings, media selection and corrected history without restarting work', () => {
    const storage = memoryStorage()
    const saved = emptySession()
    saved.draft = 'Add a rabbit\nwith a hat'
    saved.configuration = {
      resolution: '768p',
      aspect_ratio: '9:16',
      memory: 20,
    }
    saved.directions = [
      {
        id: 'bear',
        prompt: 'Cartoon dancing bear',
        version: 2,
        status: 'applied',
        submittedAt: 1,
      },
      {
        id: 'rabbit',
        prompt: 'Add a rabbit',
        version: 3,
        status: 'pending',
        submittedAt: 2,
      },
    ]
    saved.version = 3
    saved.epoch = 2
    saved.previewId = 'recording'
    writeSession(storage, 'alice', saved)
    const restored = readSession(storage, 'alice')!
    expect(restored.draft).toBe(saved.draft)
    expect(restored.configuration).toEqual(saved.configuration)
    expect(restored.previewId).toBe('recording')
    expect(restored.directions[0]).toEqual(saved.directions[0])
    expect(restored.directions[1]).toMatchObject({
      status: 'failed',
      error: expect.stringContaining('interrupted'),
    })
    expect(restored.version).toBe(3)
    expect(restored.epoch).toBe(2)
    expect(readSession(storage, 'bob')).toBeNull()
  })

  it('keeps an explicit empty snapshot after clearing, so legacy history cannot come back', () => {
    const storage = memoryStorage()
    writeSession(storage, 'alice', { ...emptySession(), draft: 'Old scene' })
    writeSession(storage, 'alice', emptySession())
    expect(readSession(storage, 'alice')).toEqual(emptySession())
  })

  it('fails on corrupt or unsupported state without overwriting it', () => {
    const storage = memoryStorage()
    storage.setItem('genzen-director-session-v1-alice', '{"schemaVersion":9}')
    expect(() => readSession(storage, 'alice')).toThrow()
    expect(storage.getItem('genzen-director-session-v1-alice')).toBe(
      '{"schemaVersion":9}',
    )
  })

  it('recovers work created before persistence, including opening-request redo', () => {
    const recovered = recoverLegacyJournal(
      JSON.stringify([
        {
          at: 1,
          session: 1,
          message: {
            type: 'opening',
            prompt: 'Bear',
            version: 1,
            entryId: 'bear',
          },
        },
        {
          at: 2,
          session: 2,
          message: {
            type: 'opening',
            prompt: 'Cartoon bear',
            version: 2,
            entryId: 'bear',
          },
        },
        {
          at: 3,
          session: 2,
          message: { type: 'configured', prompt_version: 2 },
        },
        {
          at: 4,
          session: 2,
          message: { type: 'recording_started', id: 'take' },
        },
        {
          at: 5,
          session: 2,
          message: {
            type: 'prompt_sent',
            prompt: 'Add a rabbit',
            version: 3,
            entryId: 'rabbit',
          },
        },
      ]),
    )!
    expect(recovered.directions.map((entry) => entry.prompt)).toEqual([
      'Cartoon bear',
      'Add a rabbit',
    ])
    expect(recovered.directions.map((entry) => entry.status)).toEqual([
      'applied',
      'failed',
    ])
    expect(recovered.previewId).toBe('take')
    expect(recovered.version).toBe(3)
  })
})
