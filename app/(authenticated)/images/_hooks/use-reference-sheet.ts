'use client'

import { useCallback, useState } from 'react'
import { saveAs } from 'file-saver'
import { toast } from '#/components'

/**
 * A stitched sheet is minutes of compositing at worst and seconds at best, but
 * a stalled request is neither -- without this the drawer's button stays
 * spinning with nothing behind it.
 */
const TIMEOUT_MS = 180_000

const FALLBACK_NAME = 'reference-sheet.png'

/** The server names the file, because only it knows the cell count and the
 *  finished dimensions -- and those are the record of what was tried. */
function nameFrom(disposition: string | null): string {
  const match = disposition?.match(/filename="([^"]+)"/)
  return match?.[1] ?? FALLBACK_NAME
}

export interface ReferenceSheetState {
  busy: boolean
  create: (ids: Array<string>) => Promise<void>
}

/**
 * Composite the selected images into one sheet and download it (#476).
 *
 * **Download, not storage.** The test loop this exists for is download ->
 * re-upload -> prompt, so anything between the click and the file on disk is
 * friction. Whether a sheet is ever a stored object -- its own class, with its
 * own deletion rules -- is the interesting design, and it should follow this
 * test rather than precede it.
 */
export function useReferenceSheet(): ReferenceSheetState {
  const [busy, setBusy] = useState(false)

  const create = useCallback(async (ids: Array<string>) => {
    if (ids.length === 0) return

    setBusy(true)
    try {
      const response = await fetch('/api/reference-sheet', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })

      if (!response.ok) {
        // 422 carries a sentence worth showing (too much image); anything else
        // is a broken object or a dead bucket, which reads the same either way.
        const message =
          response.status === 422
            ? await response.text()
            : 'Could not create the reference sheet'
        toast.error(message || 'Could not create the reference sheet')
        return
      }

      const name = nameFrom(response.headers.get('content-disposition'))
      saveAs(await response.blob(), name)

      // Says what was actually made, because the sheet leaves for the file
      // system and this is the last chance to say it. Cell height is the number
      // that decides whether a face survives being one cell of many.
      const cells = response.headers.get('x-sheet-cells')
      const cellHeight = response.headers.get('x-sheet-cell-height')
      toast.success(
        cells && cellHeight
          ? `${name} -- ${cells} images at ${cellHeight}px each`
          : name,
      )
    } catch (err) {
      toast.error(
        err instanceof Error && err.name === 'TimeoutError'
          ? 'That took too long. Select fewer images and try again.'
          : 'Could not create the reference sheet',
      )
    } finally {
      setBusy(false)
    }
  }, [])

  return { busy, create }
}
