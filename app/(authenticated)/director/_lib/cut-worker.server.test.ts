import { randomUUID } from 'node:crypto'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import {
  addPlannedCut,
  createSession,
  deleteCut,
  getSession,
  openCut,
  saveRun,
} from './sessions.server'
import {
  cancelCutJob,
  checkpoint,
  createCutJob,
  readCutJob,
  retryCutJob,
} from './cut-job.server'
import { runCutJob } from './cut-worker.server'
import { continuityFrame } from './cut-frame.server'
import { planCut, writeCast } from './rerun.server'
import { pronounceLines } from './storyboard.server'
import { completedPrefix, cutProgressLabel } from './cut-job'
import { sql } from '#/lib/server/db.server'
import { fal, submitFalOnce } from '#/lib/server/fal-client.server'
import { cancelFalRequest } from '#/lib/server/fal-cancel.server'

vi.mock('./cut-frame.server', () => ({ continuityFrame: vi.fn() }))
vi.mock('./rerun.server', () => ({ planCut: vi.fn(), writeCast: vi.fn() }))
vi.mock('./storyboard.server', () => ({ pronounceLines: vi.fn() }))
vi.mock('./references.server', () => ({
  collectSessionFrames: vi
    .fn()
    .mockResolvedValue([
      { imageId: randomUUID(), bytes: Buffer.from('frame') },
    ]),
}))
vi.mock('#/lib/server/fal-client.server', () => ({
  submitFalOnce: vi.fn(),
  fal: { queue: { status: vi.fn(), result: vi.fn() } },
}))
vi.mock('#/lib/server/fal-cancel.server', () => ({ cancelFalRequest: vi.fn() }))
vi.mock('#/lib/server/fal-image-inputs.server', () => ({
  uploadLibraryImagesToFal: vi.fn((ids: Array<string>) =>
    Promise.resolve(ids.map((id) => `https://example.test/${id}`)),
  ),
}))
vi.mock('#/lib/server/fal-completion.server', () => ({
  processVideoResult: vi.fn(async (id: string, owner: string) => {
    await sql`update user_images set status = 'completed' where id = ${id} and user_id = ${owner}`
  }),
}))

const isolation = vi.hoisted(() => ({
  schema: `director_queue_test_${Date.now()}`,
}))
vi.mock('#/lib/server/db.server', async () => {
  const { default: postgres } = await import('postgres')
  const client = postgres(process.env.DATABASE_URL!, {
    connection: { search_path: isolation.schema },
  })
  return {
    sql: client,
    first: <T>(rows: Array<T>) => rows[0] as T | undefined,
    jsonb: (value: unknown) => client.json(value as never),
  }
})

let owner: string
beforeAll(async () => {
  await sql.unsafe(`create schema "${isolation.schema}"`)
  for (const table of [
    'users',
    'director_sessions',
    'user_images',
    'director_cut_jobs',
  ])
    await sql.unsafe(
      `create table "${isolation.schema}".${table} (like public.${table} including all)`,
    )
  const [row] =
    await sql`insert into users (email, password_hash) values (${`${randomUUID()}@example.test`}, 'unused') returning id`
  owner = row.id
})
afterAll(async () => {
  await sql.unsafe(`drop schema "${isolation.schema}" cascade`)
  await sql.end()
})
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(planCut).mockResolvedValue({
    story: 'A man meets Descartes.',
    scenes: ['A room.'],
    shots: [
      {
        scene: 1,
        action: 'The man approaches.',
        speaker: 'The man',
        spoken: 'Hello Descartes.',
      },
      {
        scene: 1,
        action: 'Continue, then cut closer.',
        speaker: 'Descartes',
        spoken: 'Hello there.',
      },
    ],
  })
  vi.mocked(writeCast).mockResolvedValue({
    look: 'Animated.',
    characters: [{ name: 'The man', description: 'Blue turban.' }],
  })
  vi.mocked(pronounceLines).mockResolvedValue(new Map([[1, 'Hello day-kart.']]))
  vi.mocked(continuityFrame).mockResolvedValue(randomUUID())
  vi.mocked(submitFalOnce).mockResolvedValue('provider-receipt')
  vi.mocked(fal.queue.status).mockResolvedValue({
    status: 'IN_PROGRESS',
  } as never)
  vi.mocked(fal.queue.result).mockResolvedValue({
    data: { video: { url: 'https://example.test/video.mp4' } },
  } as never)
})

async function start(direction = '') {
  const session = await createSession(owner, 'Queue test')
  const clipId = randomUUID()
  await sql`insert into user_images (id, user_id, title, description, source, origin, status)
    values (${clipId}, ${owner}, 'Source', 'A man meets Descartes.', 'ai_video', 'director', 'completed')`
  const source = await addPlannedCut(owner, session.id, {
    clipIds: [clipId],
    shots: [1],
    story: 'A man meets Descartes.',
    cast: 'Photographic. The man wears a turban.',
  })
  const created = await createCutJob(owner, session.id, direction)
  return { id: created.cut.id, sessionId: session.id, source: source.cut.id }
}
async function advance(id: string, times = 1) {
  for (let i = 0; i < times; i++) await runCutJob(owner, id)
  return (await readCutJob(owner, id))!
}

describe('durable script cuts', () => {
  it('selects the cut immediately; persists all placeholders before any video; retains the canonical script', async () => {
    const { id, sessionId } = await start()
    expect((await getSession(owner, sessionId))?.cut.id).toBe(id)
    expect((await readCutJob(owner, id))?.data.shots).toEqual([])
    const planned = await advance(id, 2)
    expect(planned.data.phase).toBe('pronounce')
    expect(planned.data.shots).toHaveLength(2)
    expect((await getSession(owner, sessionId))?.cut.clipIds).toEqual(
      planned.data.shots.map((s) => s.id),
    )
    expect(submitFalOnce).not.toHaveBeenCalled()
    await advance(id, 2)
    expect(vi.mocked(submitFalOnce).mock.calls[0][1].prompt).toContain(
      'Hello day-kart.',
    )
    const [row] =
      await sql`select description from user_images where id = ${planned.data.shots[0].id} and user_id = ${owner}`
    expect(row.description).toContain('Hello Descartes.')
    expect(row.description).not.toContain('day-kart')
  })

  it('waits for completion and persisted frame before submitting clip two; survives fresh worker invocations', async () => {
    const { id } = await start()
    const rendering = await advance(id, 4)
    expect(submitFalOnce).toHaveBeenCalledTimes(1)
    expect(rendering.data.index).toBe(0)
    await advance(id, 2)
    expect(submitFalOnce).toHaveBeenCalledTimes(1)
    expect(continuityFrame).not.toHaveBeenCalled()
    vi.mocked(fal.queue.status).mockResolvedValue({
      status: 'COMPLETED',
    } as never)
    const firstDone = await advance(id)
    expect(completedPrefix(firstDone)).toEqual([rendering.data.shots[0].id])
    expect(submitFalOnce).toHaveBeenCalledTimes(1)
    const second = await advance(id)
    expect(continuityFrame).toHaveBeenCalledWith(
      owner,
      rendering.data.shots[0].id,
    )
    expect(submitFalOnce).toHaveBeenCalledTimes(2)
    const input = vi.mocked(submitFalOnce).mock.calls[1][1]
    expect(input.image_url).toBe(
      `https://example.test/${second.data.shots[1].frameId}`,
    )
    expect(cutProgressLabel(second)).toBe('Generating clip 2 of 2')
    expect((await advance(id, 2)).status).toBe('completed')
  })

  it('pauses on extraction failure and retries without regenerating the successful prefix', async () => {
    const { id } = await start()
    await advance(id, 4)
    vi.mocked(fal.queue.status).mockResolvedValue({
      status: 'COMPLETED',
    } as never)
    await advance(id)
    vi.mocked(continuityFrame).mockRejectedValueOnce(
      new Error('No ending frame'),
    )
    expect((await advance(id)).status).toBe('failed')
    expect(submitFalOnce).toHaveBeenCalledTimes(1)
    await retryCutJob(owner, id)
    expect((await advance(id)).data.shots[1].state).toBe('generating')
    expect(submitFalOnce).toHaveBeenCalledTimes(2)
  })

  it('cancels during planning; a late plan cannot add placeholders or start a video', async () => {
    const { id, sessionId } = await start()
    await advance(id)
    vi.mocked(planCut).mockImplementationOnce(async () => {
      await cancelCutJob(owner, id)
      return {
        story: 'late',
        scenes: ['room'],
        shots: [{ scene: 1, action: 'late', speaker: '', spoken: '' }],
      }
    })
    expect((await advance(id)).status).toBe('cancelled')
    expect((await getSession(owner, sessionId))?.cut.clipIds).toEqual([])
    expect(submitFalOnce).not.toHaveBeenCalled()
  })

  it('cancels a submission that returns after cancellation and never advances its tail', async () => {
    const { id } = await start()
    await advance(id, 3)
    vi.mocked(submitFalOnce).mockImplementationOnce(async () => {
      await cancelCutJob(owner, id)
      return 'late-receipt'
    })
    const cancelled = await advance(id)
    expect(cancelled.status).toBe('cancelled')
    expect(cancelFalRequest).toHaveBeenCalledWith(
      'late-receipt',
      expect.anything(),
    )
    await advance(id, 2)
    expect(submitFalOnce).toHaveBeenCalledTimes(1)
  })

  it('blocks an ambiguous submission across restart and refuses automatic retry', async () => {
    const { id } = await start()
    await advance(id, 3)
    vi.mocked(submitFalOnce).mockRejectedValueOnce(new Error('connection lost'))
    expect((await advance(id)).status).toBe('blocked')
    await advance(id, 2)
    expect(submitFalOnce).toHaveBeenCalledTimes(1)
    await expect(retryCutJob(owner, id)).rejects.toThrow('cannot be retried')
  })

  it('serializes concurrent ticks and rejects stale checkpoints', async () => {
    const { id } = await start()
    await advance(id, 3)
    const stale = (await readCutJob(owner, id))!
    await Promise.all([
      runCutJob(owner, id),
      runCutJob(owner, id),
      runCutJob(owner, id),
    ])
    expect(submitFalOnce).toHaveBeenCalledTimes(1)
    expect(await checkpoint(stale)).toBe(false)
  })

  it('passes direction to appearance and shot planning, and never steals tab selection', async () => {
    const { id, sessionId, source } = await start(
      'Animated, with a slow-motion reveal.',
    )
    await openCut(owner, sessionId, source)
    await advance(id, 2)
    expect(writeCast).toHaveBeenCalledWith(
      expect.objectContaining({
        direction: 'Animated, with a slow-motion reveal.',
      }),
    )
    expect(planCut).toHaveBeenCalledWith(
      expect.objectContaining({
        direction: 'Animated, with a slow-motion reveal.',
      }),
    )
    expect((await getSession(owner, sessionId))?.cut.id).toBe(source)
  })

  it('does not dispatch after deletion and prevents editing an active queue', async () => {
    const { id, sessionId } = await start()
    const session = (await getSession(owner, sessionId))!
    await expect(
      saveRun(owner, sessionId, session.revision, [], id),
    ).rejects.toThrow('Cancel or finish')
    await deleteCut(owner, sessionId, id)
    expect((await advance(id)).status).toBe('cancelled')
    expect(submitFalOnce).not.toHaveBeenCalled()
  })
  it('keeps the receipt when retrying a transient result error', async () => {
    const { id } = await start()
    await advance(id, 4)
    vi.mocked(fal.queue.status).mockRejectedValueOnce(
      new Error('network unavailable'),
    )
    expect((await advance(id)).status).toBe('failed')
    await retryCutJob(owner, id)
    await advance(id)
    expect(submitFalOnce).toHaveBeenCalledTimes(1)
    expect(fal.queue.status).toHaveBeenLastCalledWith(expect.any(String), {
      requestId: 'provider-receipt',
    })
  })

  it('recovers a receipt saved before the submitting checkpoint completed', async () => {
    const { id } = await start()
    const job = await advance(id, 4)
    job.data.shots[0].state = 'submitting'
    delete job.data.shots[0].requestId
    expect(await checkpoint(job)).toBe(true)
    const recovered = await advance(id)
    expect(recovered.data.shots[0].state).toBe('generating')
    expect(recovered.data.shots[0].requestId).toBe('provider-receipt')
    expect(submitFalOnce).toHaveBeenCalledTimes(1)
  })

  it('cancels pronunciation without dispatching video or losing the planned placeholders', async () => {
    const { id, sessionId } = await start()
    await advance(id, 2)
    vi.mocked(pronounceLines).mockImplementationOnce(async () => {
      await cancelCutJob(owner, id)
      return new Map([[1, 'Late words']])
    })
    expect((await advance(id)).status).toBe('cancelled')
    expect((await getSession(owner, sessionId))?.cut.clipIds).toHaveLength(2)
    expect(submitFalOnce).not.toHaveBeenCalled()
  })

  it('cancels while extracting a frame and retains the successful prefix', async () => {
    const { id } = await start()
    await advance(id, 4)
    vi.mocked(fal.queue.status).mockResolvedValue({
      status: 'COMPLETED',
    } as never)
    await advance(id)
    vi.mocked(continuityFrame).mockImplementationOnce(async () => {
      await cancelCutJob(owner, id)
      return randomUUID()
    })
    const cancelled = await advance(id)
    expect(cancelled.status).toBe('cancelled')
    expect(completedPrefix(cancelled)).toHaveLength(1)
    expect(submitFalOnce).toHaveBeenCalledTimes(1)
    expect(await readCutJob(randomUUID(), id)).toBeUndefined()
  })
})
