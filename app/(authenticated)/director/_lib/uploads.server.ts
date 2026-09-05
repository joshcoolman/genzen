import 'server-only'
import { randomUUID } from 'node:crypto'
import { appendFile, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { z } from 'zod'
import { requireSession } from './sessions.server'
import { ingestImage, ingestVideo } from './ingest.server'

export const CHUNK_BYTES = 4 * 1024 * 1024
const schema = z.object({
  sessionId: z.string().uuid(),
  size: z
    .number()
    .int()
    .positive()
    .max(100 * 1024 * 1024),
  type: z.enum([
    'video/mp4',
    'video/webm',
    'image/png',
    'image/jpeg',
    'image/webp',
  ]),
})
type Result =
  | Awaited<ReturnType<typeof ingestImage>>
  | Awaited<ReturnType<typeof ingestVideo>>
interface Upload {
  owner: string
  sessionId: string
  dir: string
  size: number
  type: string
  received: number
  busy: boolean
  result?: Result
  expires: ReturnType<typeof setTimeout>
}
const globalUploads = globalThis as typeof globalThis & {
  directorUploads?: Map<string, Upload>
}
const uploads = (globalUploads.directorUploads ??= new Map<string, Upload>())
function owned(owner: string, id: string) {
  const upload = uploads.get(id)
  if (!upload || upload.owner !== owner)
    throw new Error('Upload expired. Please retry.')
  return upload
}
export async function openUpload(owner: string, input: unknown) {
  const data = schema.parse(input)
  await requireSession(owner, data.sessionId)
  if ([...uploads.values()].filter((item) => item.owner === owner).length >= 8)
    throw new Error('Finish the current uploads first.')
  const dir = await mkdtemp(join(tmpdir(), 'genzen-director-upload-'))
  const id = randomUUID()
  const expire = () => {
    const upload = uploads.get(id)
    if (upload?.busy) {
      upload.expires = setTimeout(expire, 60000)
      upload.expires.unref()
      return
    }
    uploads.delete(id)
    void rm(dir, { recursive: true, force: true })
  }
  const expires = setTimeout(expire, 15 * 60 * 1000)
  expires.unref()
  uploads.set(id, { ...data, owner, dir, received: 0, busy: false, expires })
  return id
}
export async function appendUpload(
  owner: string,
  id: string,
  offset: number,
  bytes: Uint8Array,
) {
  const upload = owned(owner, id)
  if (
    upload.busy ||
    upload.result ||
    !Number.isInteger(offset) ||
    offset !== upload.received ||
    !bytes.length ||
    bytes.length > CHUNK_BYTES ||
    offset + bytes.length > upload.size
  )
    throw new Error('Invalid upload chunk.')
  upload.busy = true
  try {
    await appendFile(join(upload.dir, 'source'), bytes)
    upload.received += bytes.length
  } finally {
    upload.busy = false
  }
}
export async function completeUpload(owner: string, id: string) {
  const upload = owned(owner, id)
  if (upload.result) return upload.result
  if (upload.busy || upload.received !== upload.size)
    throw new Error('Upload is not ready.')
  upload.busy = true
  try {
    const blob = new Blob([await readFile(join(upload.dir, 'source'))], {
      type: upload.type,
    })
    upload.result = upload.type.startsWith('video/')
      ? await ingestVideo(owner, upload.sessionId, blob)
      : await ingestImage(owner, upload.sessionId, blob)
    await rm(upload.dir, { recursive: true, force: true })
    return upload.result
  } finally {
    upload.busy = false
  }
}
export async function discardUpload(owner: string, id: string) {
  const upload = owned(owner, id)
  if (upload.busy) return
  clearTimeout(upload.expires)
  uploads.delete(id)
  await rm(upload.dir, { recursive: true, force: true })
}
