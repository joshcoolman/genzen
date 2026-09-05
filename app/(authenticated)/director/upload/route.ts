import { sameOrigin } from '../../lab/director/request-origin'
import {
  CHUNK_BYTES,
  appendUpload,
  completeUpload,
  discardUpload,
  openUpload,
} from '../_lib/uploads.server'
import { resolveAuth } from '#/lib/server/auth.server'

export const runtime = 'nodejs'
export async function POST(request: Request) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 })
  const { userId } = await resolveAuth()
  const url = new URL(request.url)
  try {
    const operation = url.searchParams.get('operation')
    const id = url.searchParams.get('id') ?? ''
    if (operation === 'finish')
      return Response.json(await completeUpload(userId, id))
    if (operation === 'discard') {
      await discardUpload(userId, id)
      return Response.json({ ok: true })
    }
    const reader = request.body?.getReader()
    if (!reader) throw new Error('Missing upload body.')
    const chunks: Array<Uint8Array> = []
    let size = 0
    try {
      for (;;) {
        const chunk = await reader.read()
        if (chunk.done) break
        size += chunk.value.length
        if (size > (operation === 'create' ? 16000 : CHUNK_BYTES)) {
          await reader.cancel()
          throw new Error('Upload too large.')
        }
        chunks.push(chunk.value)
      }
    } finally {
      reader.releaseLock()
    }
    const bytes = Buffer.concat(chunks)
    if (operation === 'create')
      return Response.json({
        id: await openUpload(userId, JSON.parse(bytes.toString())),
      })
    if (operation === 'append') {
      await appendUpload(
        userId,
        id,
        Number(url.searchParams.get('offset')),
        bytes,
      )
      return Response.json({ ok: true })
    }
    throw new Error('Unknown upload operation.')
  } catch (error) {
    console.error('[director upload]', error)
    return Response.json(
      {
        error: 'Upload failed. Your saved session is unchanged; please retry.',
      },
      { status: 400 },
    )
  }
}
