import 'server-only'
import { randomUUID } from 'node:crypto'
import { appendFile, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { UPLOAD_CHUNK_BYTES, exportManifestSchema } from './export-policy'
import { stitchSilent } from './stitch-silent.server'
import type { ExportManifest } from './export-policy'

interface Job {
  owner: string
  dir: string
  clips: ExportManifest
  received: Array<number>
  busy: boolean
  expires: ReturnType<typeof setTimeout>
}
// Keep temporary ownership through dev HMR. Restart never makes an old ID valid.
const globalJobs = globalThis as typeof globalThis & {
  directorExports?: Map<string, Job>
}
const jobs = (globalJobs.directorExports ??= new Map<string, Job>())
const opening = new Set<string>()

export async function createExport(owner: string, input: unknown) {
  const clips = exportManifestSchema.parse(input)
  if (
    opening.has(owner) ||
    [...jobs.values()].some((job) => job.owner === owner)
  )
    throw new Error(
      'An export is already running. Finish it or wait for it to expire.',
    )
  opening.add(owner)
  try {
    const dir = await mkdtemp(join(tmpdir(), 'genzen-director-export-'))
    const id = randomUUID()
    const expire = () => {
      const job = jobs.get(id)
      if (!job) return
      if (job.busy) {
        job.expires = setTimeout(expire, 60000)
        job.expires.unref()
      } else void removeExport(owner, id).catch(() => {})
    }
    const expires = setTimeout(expire, 15 * 60 * 1000)
    expires.unref()
    jobs.set(id, {
      owner,
      dir,
      clips,
      received: clips.map(() => 0),
      busy: false,
      expires,
    })
    return id
  } finally {
    opening.delete(owner)
  }
}
function owned(owner: string, id: string) {
  const job = jobs.get(id)
  if (!job || job.owner !== owner)
    throw new Error(
      'This temporary export is unavailable. Please export again.',
    )
  if (job.busy) throw new Error('This export is already processing.')
  return job
}
export async function appendExport(
  owner: string,
  id: string,
  index: number,
  offset: number,
  bytes: Uint8Array,
) {
  const job = owned(owner, id)
  const clip = job.clips.at(index)
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    !clip ||
    !Number.isInteger(offset) ||
    offset !== job.received[index] ||
    !bytes.byteLength ||
    bytes.byteLength > UPLOAD_CHUNK_BYTES ||
    offset + bytes.byteLength > clip.size
  )
    throw new Error('Invalid or out-of-order export upload.')
  job.busy = true
  try {
    await appendFile(join(job.dir, `source-${index}`), bytes)
    job.received[index] += bytes.byteLength
  } finally {
    job.busy = false
  }
}
export async function removeExport(owner: string, id: string) {
  const job = owned(owner, id)
  jobs.delete(id)
  clearTimeout(job.expires)
  await rm(job.dir, { recursive: true, force: true })
}
export async function finishExport(owner: string, id: string) {
  const job = owned(owner, id)
  if (job.clips.some((clip, index) => clip.size !== job.received[index]))
    throw new Error('Some sections have not finished uploading.')
  job.busy = true
  try {
    const path = await stitchSilent(job.dir, job.clips)
    return new Uint8Array(await readFile(path))
  } finally {
    job.busy = false
    await removeExport(owner, id)
  }
}
