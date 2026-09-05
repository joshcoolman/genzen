import { describe, expect, it } from 'vitest'
import { applyMessage, parseMessage, submitDirection } from './protocol'

describe('Director corrections', () => {
  it('replaces a pending opening request in place, then adds the rabbit', () => {
    const original = submitDirection(
      [],
      'Show me a dancing bear',
      1,
      false,
      1,
      'bear',
    )
    const corrected = submitDirection(
      original,
      'Show me a cartoon dancing bear',
      2,
      true,
      2,
      'unused',
    )
    expect(corrected).toHaveLength(1)
    expect(corrected[0]).toMatchObject({
      id: 'bear',
      version: 2,
      prompt: 'Show me a cartoon dancing bear',
    })
    const continued = submitDirection(
      corrected,
      'Add a rabbit',
      3,
      false,
      3,
      'rabbit',
    )
    expect(continued.map((entry) => entry.prompt)).toEqual([
      'Show me a cartoon dancing bear',
      'Add a rabbit',
    ])
    expect(() =>
      submitDirection(continued, 'A blue rabbit', 4, true, 4, 'unused'),
    ).toThrow('context restoration')
  })

  it('does not let old acknowledgements, rejections or errors settle a replacement', () => {
    const original = submitDirection([], 'Bear', 1, false, 1, 'bear')
    const corrected = submitDirection(
      original,
      'Cartoon bear',
      2,
      true,
      2,
      'unused',
    )
    for (const message of [
      { type: 'prompt_applied', prompt_version: 1 },
      { type: 'prompt_rejected', prompt_version: 1, reason: 'content_policy' },
      {
        type: 'error',
        prompt_version: 1,
        error: 'Old failure',
        code: 'generation_failed',
      },
    ]) {
      expect(
        applyMessage(corrected, parseMessage(JSON.stringify(message))!, 4),
      ).toEqual(corrected)
    }
    const applied = applyMessage(
      corrected,
      { type: 'prompt_applied', prompt_version: 2 },
      5,
    )
    expect(applied[0]).toMatchObject({ status: 'applied', settledAt: 5 })
    expect(
      applyMessage(applied, { type: 'prompt_pending', prompt_version: 2 }, 6),
    ).toEqual(applied)
  })

  it('keeps prior directions when the latest request is rejected', () => {
    let entries = submitDirection([], 'Bear', 1, false, 1, 'bear')
    entries = applyMessage(
      entries,
      { type: 'configured', prompt_version: 1 },
      2,
    )
    entries = submitDirection(entries, 'Rabbit', 2, false, 3, 'rabbit')
    entries = applyMessage(
      entries,
      { type: 'prompt_rejected', prompt_version: 2, reason: 'content_policy' },
      4,
    )
    expect(entries.map((entry) => entry.status)).toEqual([
      'applied',
      'rejected',
    ])
  })

  it('rejects malformed provider data instead of trusting a type assertion', () => {
    expect(parseMessage('{')).toBeNull()
    expect(
      parseMessage('{"type":"prompt_applied","prompt_version":"2"}'),
    ).toBeNull()
    expect(parseMessage('{"type":"new_protocol_message"}')).toBeNull()
    expect(() => submitDirection([], '  ', 1, false, 1, 'a')).toThrow()
  })
})
