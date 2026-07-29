'use client'

import { useCallback } from 'react'
import { saveAs } from 'file-saver'
import JSZip from 'jszip'
import type { SavedAiImage } from '#/features/ai-images/types'
import { createImageStorage } from '#/lib/image-storage'

export interface DownloadsState {
  downloadOne: (img: SavedAiImage) => Promise<void>
  downloadMany: (images: Array<SavedAiImage>) => Promise<void>
}

/** One image saves straight through; more than one is zipped. A selection of
 *  exactly one takes the single-file path rather than producing a one-entry
 *  archive. */
export function useDownloads(): DownloadsState {
  const downloadOne = useCallback(async (img: SavedAiImage) => {
    const path = img.storage_path
    if (!path) return
    const url = await createImageStorage().getUrl(path)
    if (!url) return
    saveAs(url, `${img.title}.png`)
  }, [])

  const downloadMany = useCallback(
    async (images: Array<SavedAiImage>) => {
      const withFiles = images.filter((img) => img.storage_path)
      if (withFiles.length === 0) return
      if (withFiles.length === 1) {
        await downloadOne(withFiles[0])
        return
      }
      const zip = new JSZip()
      await Promise.all(
        withFiles.map(async (img) => {
          const url = await createImageStorage().getUrl(img.storage_path!)
          if (!url) return
          const resp = await fetch(url)
          zip.file(`${img.title}.png`, await resp.blob())
        }),
      )
      saveAs(await zip.generateAsync({ type: 'blob' }), 'edit-images.zip')
    },
    [downloadOne],
  )

  return { downloadOne, downloadMany }
}
