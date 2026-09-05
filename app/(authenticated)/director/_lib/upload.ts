export async function uploadMedia(sessionId: string, blob: Blob) {
  async function post(operation: string, body?: BodyInit, extra = '') {
    const response = await fetch(
      `/director/upload?operation=${operation}${extra}`,
      { method: 'POST', body },
    )
    if (!response.ok) throw new Error('Media could not be saved. Please retry.')
    return response.json()
  }
  const type = blob.type.split(';')[0]
  const { id } = await post(
    'create',
    JSON.stringify({ sessionId, size: blob.size, type }),
  )
  try {
    for (let offset = 0; offset < blob.size; offset += 4 * 1024 * 1024)
      await post(
        'append',
        blob.slice(offset, offset + 4 * 1024 * 1024),
        `&id=${id}&offset=${offset}`,
      )
    return (await post('finish', undefined, `&id=${id}`)) as {
      mediaId: string
      endFrameId?: string
      thumbnailId?: string
      duration?: number
    }
  } finally {
    void fetch(`/director/upload?operation=discard&id=${id}`, {
      method: 'POST',
      keepalive: true,
    }).catch(() => {})
  }
}
