import { describe, expect, it } from 'vitest'
import {
  completeClip,
  emptyCut,
  generationBase,
  latestJoin,
  nextIndex,
} from './clips'
import type { Clip, PendingClip } from './clips'

const clip = (id: string): Clip => ({
  id,
  prompt: id,
  blob: new Blob(['video']),
  endFrame: new Blob([id]),
  duration: 5,
  model: 'turbo',
})
describe('clip continuation and replacement', () => {
  it('uses the ending of the sequence, independent of the player position', () => {
    const cut = { ...emptyCut(), clips: [clip('bear'), clip('rabbit')] }
    expect(generationBase(cut, null)).toEqual({
      image: cut.clips[1].endFrame,
      tail: null,
      context: ['bear', 'rabbit'],
    })
    expect(generationBase(cut, 1)).toEqual({
      image: cut.clips[0].endFrame,
      tail: null,
      context: ['bear'],
    })
  })
  it('redoes an opening without feeding the rejected bear back to the model', () => {
    const cut = { ...emptyCut(), clips: [clip('real bear')] }
    expect(generationBase(cut, 0)).toEqual({
      image: null,
      tail: null,
      context: [],
    })
  })
  it('keeps the old clip until a matching replacement successfully completes', () => {
    const pending: PendingClip = {
      id: 'new',
      prompt: 'cartoon bear',
      context: [],
      settings: emptyCut().settings,
      redo: true,
      replace: 0,
      startedAt: 0,
    }
    const cut = { ...emptyCut(), clips: [clip('old')], pending }
    expect(completeClip(cut, { ...pending, id: 'stale' }, clip('new'))).toBe(
      cut,
    )
    const done = completeClip(cut, pending, clip('new'))
    expect(done.clips.map((c) => c.id)).toEqual(['new'])
    expect(cut.clips[0].id).toBe('old')
    expect(done.pending).toBeNull()
  })
  it('continues but refuses to redo imported recordings', () => {
    const cut = { ...emptyCut(), clips: [{ ...clip('saved'), imported: true }] }
    expect(generationBase(cut, null).image).toBe(cut.clips[0].endFrame)
    expect(() => generationBase(cut, 0)).toThrow('not redone')
  })
  it('pins a replaced middle section to the frame the next one opens on', () => {
    const cut = {
      ...emptyCut(),
      clips: [clip('one'), clip('two'), clip('three')],
    }
    expect(generationBase(cut, 1)).toEqual({
      image: cut.clips[0].endFrame,
      tail: cut.clips[1].endFrame,
      context: ['one'],
    })
    // The last section has nothing to meet, so it is free to end anywhere.
    expect(generationBase(cut, 2).tail).toBeNull()
  })
  it('replaces the section a request named, not the newest one', () => {
    const pending: PendingClip = {
      id: 'fresh',
      prompt: 'a different middle',
      context: ['one'],
      settings: emptyCut().settings,
      redo: false,
      replace: 1,
      startedAt: 0,
    }
    const cut = {
      ...emptyCut(),
      clips: [clip('one'), clip('two'), clip('three')],
      pending,
    }
    expect(
      completeClip(cut, pending, clip('new')).clips.map((c) => c.id),
    ).toEqual(['one', 'new', 'three'])
  })
  it('wraps the sequence and locates the newest join', () => {
    expect(nextIndex(5, 6)).toBe(0)
    expect(nextIndex(0, 1)).toBe(0)
    expect(latestJoin(6)).toBe(4)
    expect(latestJoin(1)).toBe(0)
  })
})
