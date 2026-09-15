import { describe, expect, it } from 'vitest'
import { parseChat } from './types'

describe('chat sessions (#670)', () => {
  it('reads null as a run and garbage as an empty chat', () => {
    expect(parseChat(null)).toBeNull()
    expect(parseChat(undefined)).toBeNull()
    expect(parseChat({ version: 9 })).toEqual({
      version: 1,
      character: null,
      turns: [],
    })
  })
})
