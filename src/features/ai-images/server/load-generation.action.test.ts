import { beforeEach, expect, it, vi } from 'vitest'
import { loadGeneration } from './load-generation.action'

const mocks = vi.hoisted(() => ({ sql: vi.fn(), inputs: vi.fn() }))
vi.mock('#/lib/server/auth.server', () => ({
  resolveAuth: () => Promise.resolve({ userId: 'owner' }),
}))
vi.mock('#/lib/server/db.server', () => ({
  sql: mocks.sql,
  first: (rows: Array<unknown>) => rows[0],
}))
vi.mock('./generation-inputs.server', () => ({
  resolveGenerationInputs: mocks.inputs,
}))
beforeEach(() => vi.resetAllMocks())
it('loads an editable storyboard invocation and ordered available references, never its rendering prompt', async () => {
  mocks.sql.mockResolvedValue([
    {
      generation_metadata: {
        prompt: '/storyboard Four shots of a chase',
        sent_prompt: 'long exact renderer instruction',
        image_skill: { id: 'storyboard' },
        aspect_ratio: '8:3',
      },
    },
  ])
  mocks.inputs.mockResolvedValue([
    { id: 'first', title: 'car', storagePath: 'a', isDeleted: false },
    { id: 'second', title: 'road', storagePath: 'b', isDeleted: false },
    { id: 'third', title: 'missing', storagePath: null, isDeleted: false },
  ])
  expect(await loadGeneration('run')).toEqual({
    prompt: '/storyboard Four shots of a chase',
    aspectRatio: '8:3',
    images: [
      { id: 'first', title: 'car' },
      { id: 'second', title: 'road' },
    ],
    missing: 1,
  })
})
it('keeps older non-skill rows loadable', async () => {
  mocks.sql.mockResolvedValue([{ generation_metadata: { prompt: 'a cat' } }])
  mocks.inputs.mockResolvedValue([])
  expect(await loadGeneration('old')).toMatchObject({
    prompt: 'a cat',
    aspectRatio: null,
    images: [],
  })
})
