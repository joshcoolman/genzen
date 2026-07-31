'use client'

import { useCallback, useState } from 'react'
import { saveAs } from 'file-saver'
import type { SavedAiImage } from '#/features/ai-images/types'
import { imageUrl } from '#/lib/image-url'

/** The stored key keeps the original extension; fall back to png. */
function extensionOf(path: string): string {
  const base = path.split('/').pop() ?? path
  const dot = base.lastIndexOf('.')
  return dot > 0 ? base.slice(dot) : '.png'
}

export interface DownloadState {
  target: SavedAiImage | null
  name: string
  busy: boolean
  setName: (name: string) => void
  start: (img: SavedAiImage) => void
  cancel: () => void
  save: () => Promise<void>
}

/**
 * Downloading an image, which is two steps: name it, then fetch and save it.
 *
 * The name is the user's, so it is sanitised of path separators rather than
 * trusted -- `saveAs` would otherwise be handed something the OS reads as a
 * directory.
 */
export function useDownload(): DownloadState {
  const [target, setTarget] = useState<SavedAiImage | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  const start = useCallback((img: SavedAiImage) => {
    setTarget(img)
    setName(img.title || '')
  }, [])

  const cancel = useCallback(() => setTarget(null), [])

  const save = useCallback(async () => {
    const storagePath = target?.storage_path
    if (!storagePath) return
    const baseName = (name || target.id).replace(/[/\\:*?"<>|]/g, '-')

    setBusy(true)
    try {
      // Same-origin, so the session cookie rides along and the route
      // authorises it -- there is no public object URL to fetch since #226.
      const response = await fetch(imageUrl(target.id))
      if (!response.ok) return
      saveAs(await response.blob(), `${baseName}${extensionOf(storagePath)}`)
    } finally {
      setBusy(false)
      setTarget(null)
    }
  }, [target, name])

  return { target, name, busy, setName, start, cancel, save }
}
