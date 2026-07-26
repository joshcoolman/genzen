'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import type { UserImage } from '@/features/user-images/types'
import { ActionButton } from '@/components/ActionButton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

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

interface TrashDownloadButtonProps {
  images: Array<UserImage>
  signFullResUrls: (imgs: Array<UserImage>) => Promise<Record<string, string>>
}

export function TrashDownloadButton({
  images,
  signFullResUrls,
}: TrashDownloadButtonProps) {
  const [open, setOpen] = useState(false)
  const [zipName, setZipName] = useState('')
  const [isDownloading, setIsDownloading] = useState(false)
  const [status, setStatus] = useState('')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  if (images.length === 0) return null

  function handleOpen(isOpen: boolean) {
    if (isOpen) {
      const date = new Date().toISOString().slice(0, 10)
      setZipName(`trash-${date}`)
      setProgress(0)
      setStatus('')
      setError(null)
    }
    if (!isDownloading) setOpen(isOpen)
  }

  async function handleDownload() {
    if (!zipName.trim()) return

    setIsDownloading(true)
    setProgress(0)
    setError(null)
    setStatus('Preparing download...')

    try {
      setStatus('Signing URLs...')
      const urls = await signFullResUrls(images)

      const items = images
        .filter((img) => urls[img.id])
        .map((img) => ({
          url: urls[img.id],
          name: img.file_name || `${img.id}.png`,
        }))

      if (items.length === 0) {
        setError('No downloadable images found')
        return
      }

      const total = items.length
      setStatus(`Downloading 0 / ${total}...`)
      const blobs = await fetchInBatches(items, (completed) => {
        const pct = Math.round((completed / total) * 100)
        setProgress(pct)
        setStatus(`Downloading ${completed} / ${total}...`)
      })

      setStatus('Creating ZIP...')
      const zip = new JSZip()
      const baseName = zipName.trim().replace(/\.zip$/i, '')
      blobs.forEach(({ name, blob }, i) => {
        const dot = name.lastIndexOf('.')
        const ext = dot > 0 ? name.slice(dot) : '.png'
        zip.file(`${baseName}-${i}${ext}`, blob)
      })

      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const safeName = zipName.trim().replace(/\.zip$/i, '')
      saveAs(zipBlob, `${safeName}.zip`)
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed')
    } finally {
      setIsDownloading(false)
      setProgress(0)
      setStatus('')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="mr-2 h-4 w-4" />
          Download
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Download Trash Images</DialogTitle>
          <DialogDescription>
            Download {images.length} {images.length === 1 ? 'image' : 'images'}{' '}
            as a ZIP file.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <label htmlFor="zip-name" className="mb-2 block text-sm font-medium">
            File name
          </label>
          <div className="flex items-center gap-2">
            <Input
              id="zip-name"
              value={zipName}
              onChange={(e) => setZipName(e.target.value)}
              disabled={isDownloading}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isDownloading) handleDownload()
              }}
            />
            <span className="shrink-0 text-sm text-muted-foreground">.zip</span>
          </div>
          {isDownloading && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-sm font-medium text-accent-brand">
                <span>{status}</span>
                {progress > 0 && (
                  <span className="tabular-nums">{progress}%</span>
                )}
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-accent-brand transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <ActionButton
            onClick={handleDownload}
            disabled={!zipName.trim()}
            loading={isDownloading}
            loadingText={
              progress > 0 ? `Downloading ${progress}%` : 'Preparing...'
            }
            icon={<Download className="h-4 w-4" />}
          >
            Download
          </ActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
