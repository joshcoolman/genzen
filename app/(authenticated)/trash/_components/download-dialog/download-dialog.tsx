'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import styles from './download-dialog.module.css'
import type { UserImage } from '#/features/user-images/types'
// Trash is the pilot route for the Base UI set, so these come from the folders
// rather than the root barrel: the shadcn `Dialog` and `Input` still occupy
// those names there for the other 16 consumers. The deep imports go the moment
// the barrel flips.
import { Button } from '#/components/button/button'
import { Input } from '#/components/input/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#/components/dialog/dialog'

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

interface DownloadDialogProps {
  images: Array<UserImage>
  signFullResUrls: (imgs: Array<UserImage>) => Promise<Record<string, string>>
}

export function DownloadDialog({
  images,
  signFullResUrls,
}: DownloadDialogProps) {
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
      <DialogTrigger render={<Button variant="secondary" size="sm" />}>
        <Download className={styles.triggerIcon} />
        Download
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Download Trash Images</DialogTitle>
          <DialogDescription>
            Download {images.length} {images.length === 1 ? 'image' : 'images'}{' '}
            as a ZIP file.
          </DialogDescription>
        </DialogHeader>
        <div className={styles.body}>
          <label htmlFor="zip-name" className={styles.label}>
            File name
          </label>
          <div className={styles.field}>
            <Input
              id="zip-name"
              value={zipName}
              onChange={(e) => setZipName(e.target.value)}
              disabled={isDownloading}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isDownloading) handleDownload()
              }}
            />
            <span className={styles.suffix}>.zip</span>
          </div>
          {isDownloading && (
            <div className={styles.progress}>
              <div className={styles.progressLabel}>
                <span>{status}</span>
                {progress > 0 && (
                  <span className={styles.percent}>{progress}%</span>
                )}
              </div>
              <div className={styles.track}>
                <div className={styles.bar} style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
          {error && <p className={styles.error}>{error}</p>}
        </div>
        <DialogFooter>
          {/* Was `ActionButton`, which existed only because shadcn's Button had
              no loading state. The ported one does, so the label swap that
              `loadingText` used to own lives here instead. */}
          <Button
            variant="primary"
            onClick={handleDownload}
            disabled={!zipName.trim()}
            loading={isDownloading}
          >
            {!isDownloading && <Download className={styles.footerIcon} />}
            {isDownloading
              ? progress > 0
                ? `Downloading ${progress}%`
                : 'Preparing...'
              : 'Download'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
