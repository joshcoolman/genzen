import { useCallback, useState } from 'react'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import type { UserImage } from '../types'

interface DownloadState {
  isDownloading: boolean
  progress: number
  currentFile: string
}

const CONCURRENCY = 4

async function fetchInBatches(
  items: Array<{ url: string; name: string }>,
  onProgress: (completed: number, current: string) => void,
): Promise<Array<{ name: string; blob: Blob }>> {
  const results: Array<{ name: string; blob: Blob }> = []
  let completed = 0

  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const batch = items.slice(i, i + CONCURRENCY)
    const batchResults = await Promise.all(
      batch.map(async (item) => {
        onProgress(completed, item.name)
        const response = await fetch(item.url)
        if (!response.ok) throw new Error(`Failed to fetch ${item.name}`)
        const blob = await response.blob()
        completed++
        onProgress(completed, item.name)
        return { name: item.name, blob }
      }),
    )
    results.push(...batchResults)
  }

  return results
}

export function useDownloadImages(
  images: Array<UserImage>,
  imageUrls: Record<string, string>,
) {
  const [state, setState] = useState<DownloadState>({
    isDownloading: false,
    progress: 0,
    currentFile: '',
  })

  const counts = {
    all: images.length,
    upload: images.filter((img) => img.source === 'upload').length,
    ai_generated: images.filter((img) => img.source === 'ai_generated').length,
  }

  const download = useCallback(
    async (filter: 'all' | 'upload' | 'ai_generated') => {
      const filtered =
        filter === 'all'
          ? images
          : images.filter((img) => img.source === filter)

      if (filtered.length === 0) return

      const items = filtered
        .filter((img) => imageUrls[img.id])
        .map((img) => ({
          url: imageUrls[img.id],
          name: img.file_name || `${img.id}.png`,
        }))

      if (items.length === 0) return

      setState({ isDownloading: true, progress: 0, currentFile: '' })

      try {
        const total = items.length
        const blobs = await fetchInBatches(items, (completed, current) => {
          setState((prev) => ({
            ...prev,
            progress: Math.round((completed / total) * 100),
            currentFile: current,
          }))
        })

        const zip = new JSZip()
        const usedNames = new Set<string>()
        for (const { name, blob } of blobs) {
          let uniqueName = name
          let counter = 1
          while (usedNames.has(uniqueName)) {
            const dot = name.lastIndexOf('.')
            const base = dot > 0 ? name.slice(0, dot) : name
            const ext = dot > 0 ? name.slice(dot) : ''
            uniqueName = `${base}-${counter}${ext}`
            counter++
          }
          usedNames.add(uniqueName)
          zip.file(uniqueName, blob)
        }

        const label =
          filter === 'all'
            ? 'all'
            : filter === 'upload'
              ? 'uploads'
              : 'ai-generated'
        const timestamp = new Date().toISOString().slice(0, 10)
        const zipBlob = await zip.generateAsync({ type: 'blob' })
        saveAs(zipBlob, `genzen-${label}-${timestamp}.zip`)
      } finally {
        setState({ isDownloading: false, progress: 0, currentFile: '' })
      }
    },
    [images, imageUrls],
  )

  return { ...state, counts, download }
}
