'use server'

import { resolveAuth } from '#/lib/server/auth.server'

export async function fetchImageAsBase64(data: { url: string }) {
  await resolveAuth()
  const response = await fetch(data.url)
  if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`)
  const buffer = await response.arrayBuffer()
  const contentType = response.headers.get('content-type') ?? 'image/png'
  const base64 = Buffer.from(buffer).toString('base64')
  return { base64: `data:${contentType};base64,${base64}` }
}
