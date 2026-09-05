import {
  appendExport,
  createExport,
  finishExport,
  removeExport,
} from '../export-jobs.server'
import { UPLOAD_CHUNK_BYTES } from '../export-policy'
import { resolveAuth } from '#/lib/server/auth.server'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== 'development')
    return new Response(null, { status: 403 })
  const url = new URL(request.url)
  if (request.headers.get('origin') !== url.origin)
    return new Response(null, { status: 403 })
  let owner: string
  try {
    owner = (await resolveAuth()).userId
  } catch {
    return new Response(null, { status: 401 })
  }
  try {
    const operation = url.searchParams.get('operation')
    const id = url.searchParams.get('id') ?? ''
    if (operation === 'create') {
      const bytes = await limitedBody(request, 16000)
      return Response.json({
        id: await createExport(
          owner,
          JSON.parse(new TextDecoder().decode(bytes)),
        ),
      })
    }
    if (operation === 'upload') {
      const bytes = await limitedBody(request, UPLOAD_CHUNK_BYTES)
      await appendExport(
        owner,
        id,
        Number(url.searchParams.get('index')),
        Number(url.searchParams.get('offset')),
        bytes,
      )
      return Response.json({ ok: true })
    }
    if (operation === 'finish') {
      const bytes = await finishExport(owner, id)
      return new Response(bytes, {
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Disposition': 'attachment; filename="director-cut.mp4"',
          'Cache-Control': 'private, no-store',
        },
      })
    }
    if (operation === 'discard') {
      await removeExport(owner, id)
      return Response.json({ ok: true })
    }
    return new Response(null, { status: 400 })
  } catch {
    return Response.json(
      {
        error:
          'Export could not complete. Your saved cut is unchanged. Please try again.',
      },
      { status: 400 },
    )
  }
}

async function limitedBody(request: Request, limit: number) {
  const reader = request.body?.getReader()
  if (!reader) throw new Error('Missing upload.')
  const parts: Array<Uint8Array> = []
  let size = 0
  try {
    let chunk = await reader.read()
    while (!chunk.done) {
      const value = chunk.value
      size += value.byteLength
      if (size > limit) {
        await reader.cancel()
        throw new Error('Upload too large.')
      }
      parts.push(value)
      chunk = await reader.read()
    }
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const part of parts) {
    bytes.set(part, offset)
    offset += part.byteLength
  }
  return bytes
}
