'use client'

import { useEffect, useRef, useState } from 'react'
import { Download } from 'lucide-react'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { Button } from '../button/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../dialog/dialog'
import { Input } from '../input/input'
import styles from './zip-download-dialog.module.css'
import { imageUrl } from '#/lib/image-url'
import { sanitizeFileName, zipEntryName } from '#/lib/zip-names'

/** Four at a time, so a big set does not open sixty sockets at once. */
const CONCURRENCY = 4

/**
 * A stalled fetch is the one failure this cannot recover from on its own: the
 * batch never settles, the progress bar stops, and the dialog is stuck open
 * with no error and no way out but a reload. A minute is far past a slow
 * full-res image and far short of "did it freeze".
 */
const FETCH_TIMEOUT_MS = 60_000

async function fetchInBatches(
  items: Array<{ url: string; name: string }>,
  signal: AbortSignal,
  onProgress: (completed: number) => void,
): Promise<Array<{ name: string; blob: Blob }>> {
  const results: Array<{ name: string; blob: Blob }> = []
  let completed = 0

  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const batch = items.slice(i, i + CONCURRENCY)
    const batchResults = await Promise.all(
      batch.map(async (item) => {
        const response = await fetch(item.url, {
          signal: AbortSignal.any([
            signal,
            AbortSignal.timeout(FETCH_TIMEOUT_MS),
          ]),
        })
        if (!response.ok) throw new Error(`Failed to fetch ${item.name}`)
        const blob = await response.blob()
        completed++
        onProgress(completed)
        return { name: item.name, blob }
      }),
    )
    results.push(...batchResults)
  }

  return results
}

/** The minimum an image needs to be zippable: an id to sign and a name to
 *  take an extension from. Both `UserImage` and `SavedAiImage` satisfy it. */
export interface ZipDownloadImage {
  id: string
  storage_path?: string | null
  file_name?: string | null
}

export interface ZipDownloadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  images: Array<ZipDownloadImage>
  /** What the zip is called before anyone edits it -- a date on Trash, the
   *  group's name on a group. */
  defaultName: string
  /** The prefix the files inside get, before the number. */
  defaultPrefix?: string
  title?: string
}

/**
 * Download a set of images as one zip, naming both the zip and what is in it.
 *
 * **Two fields, not one.** The zip's name and the prefix inside it used to be
 * the same string, so naming the archive renamed every file in it. They are
 * different jobs: the zip is what you call the set, the prefix is what the
 * frames are called. The zip defaults to something meaningful (the group), the
 * prefix to something boring on purpose -- `image-01` sorts and says nothing,
 * which is what a filename inside an archive should do.
 *
 * The numbering itself is `#/lib/zip-names`, which is where the padding rule
 * and its reason live.
 *
 * Controlled, with no trigger of its own: the two callers sit in a page header
 * and in a toolbar, and each already owns a button in its own style.
 */
export function ZipDownloadDialog({
  open,
  onOpenChange,
  images,
  defaultName,
  defaultPrefix = 'image',
  title = 'Download images',
}: ZipDownloadDialogProps) {
  const [zipName, setZipName] = useState(defaultName)
  const [prefix, setPrefix] = useState(defaultPrefix)
  const [isDownloading, setIsDownloading] = useState(false)
  const [status, setStatus] = useState('')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Reset on open rather than on close, so the defaults track a group that was
  // renamed since the last time this was opened.
  useEffect(() => {
    if (!open) return
    setZipName(defaultName)
    setPrefix(defaultPrefix)
    setProgress(0)
    setStatus('')
    setError(null)
  }, [open, defaultName, defaultPrefix])

  // Closing mid-run stops the fetches; without this they run to completion
  // against a dialog nobody is looking at and then save a file nobody asked
  // for any more.
  useEffect(() => () => abortRef.current?.abort(), [])

  function handleOpenChange(next: boolean) {
    if (!next) abortRef.current?.abort()
    onOpenChange(next)
  }

  async function handleDownload() {
    const baseName = sanitizeFileName(zipName).replace(/\.zip$/i, '')
    const filePrefix = sanitizeFileName(prefix)
    if (!baseName || !filePrefix) return

    const controller = new AbortController()
    abortRef.current = controller

    setIsDownloading(true)
    setProgress(0)
    setError(null)

    try {
      const items = images
        .filter((img) => img.storage_path)
        .map((img) => ({
          url: imageUrl(img.id),
          name: img.file_name || `${img.id}.png`,
        }))

      if (items.length === 0) {
        setError('No downloadable images found')
        return
      }

      const total = items.length

      setStatus(`Downloading 0 / ${total}...`)
      const blobs = await fetchInBatches(
        items,
        controller.signal,
        (completed) => {
          setProgress(Math.round((completed / total) * 100))
          setStatus(`Downloading ${completed} / ${total}...`)
        },
      )

      setStatus('Creating ZIP...')
      const zip = new JSZip()
      blobs.forEach(({ name, blob }, i) => {
        zip.file(zipEntryName(filePrefix, i, total, name), blob)
      })

      const zipBlob = await zip.generateAsync({ type: 'blob' })
      if (controller.signal.aborted) return
      saveAs(zipBlob, `${baseName}.zip`)
      onOpenChange(false)
    } catch (err) {
      // An abort is the user closing the dialog, which is not a failure to
      // report back into a dialog that is already gone.
      if (controller.signal.aborted) return
      setError(err instanceof Error ? err.message : 'Download failed')
    } finally {
      abortRef.current = null
      setIsDownloading(false)
      setProgress(0)
      setStatus('')
    }
  }

  const canDownload = !!sanitizeFileName(zipName) && !!sanitizeFileName(prefix)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
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
                if (e.key === 'Enter' && !isDownloading) void handleDownload()
              }}
            />
            <span className={styles.suffix}>.zip</span>
          </div>

          <label htmlFor="zip-prefix" className={styles.labelStacked}>
            Image names
          </label>
          <div className={styles.field}>
            <Input
              id="zip-prefix"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              disabled={isDownloading}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isDownloading) void handleDownload()
              }}
            />
            {/* The numbering is the part nobody can guess from a prefix field.
                No extension shown: each file keeps its own, so a mixed set has
                more than one and a single example would misstate it. */}
            <span className={styles.suffix}>
              -{'1'.padStart(Math.max(2, String(images.length).length), '0')}
            </span>
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
          <Button
            variant="primary"
            onClick={() => void handleDownload()}
            disabled={!canDownload}
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
