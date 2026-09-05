'use client'

import { useEffect, useRef, useState } from 'react'
import { exportCut, selectedClips } from '../../export-cut'
import { ExportTile } from '../export-tile/export-tile'
import styles from './export-preview.module.css'
import type { Clip } from '../../clips'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '#/components'

export function ExportPreview({
  clips,
  onClose,
}: {
  clips: Array<Clip>
  onClose: () => void
}) {
  const [selected, setSelected] = useState(
    () => new Set(clips.map((clip) => clip.id)),
  )
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState(
    'Choose which sections to include. Your original cut will not change.',
  )
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const controller = useRef<AbortController | null>(null)
  const resultUrl = useRef<string | null>(null)
  const included = selectedClips(clips, selected)
  const duration = included.reduce((sum, clip) => sum + clip.duration, 0)

  useEffect(
    () => () => {
      controller.current?.abort()
      if (resultUrl.current) URL.revokeObjectURL(resultUrl.current)
    },
    [],
  )

  function selectionChanged(next: Set<string>) {
    if (busy) return
    setSelected(next)
    if (resultUrl.current) URL.revokeObjectURL(resultUrl.current)
    resultUrl.current = null
    setResult(null)
    setError(null)
    setStatus('Selection updated. Export keeps the original playback order.')
  }
  async function prepare() {
    if (controller.current || !included.length) return
    const abort = new AbortController()
    controller.current = abort
    setBusy(true)
    setError(null)
    try {
      const blob = await exportCut(
        included,
        (message) => {
          if (!abort.signal.aborted) setStatus(message)
        },
        abort.signal,
      )
      if (abort.signal.aborted) return
      if (resultUrl.current) URL.revokeObjectURL(resultUrl.current)
      resultUrl.current = URL.createObjectURL(blob)
      setResult(resultUrl.current)
    } catch (cause) {
      if (!abort.signal.aborted)
        setError(
          cause instanceof Error
            ? cause.message
            : 'Export failed. Your cut is unchanged.',
        )
    } finally {
      controller.current = null
      if (!abort.signal.aborted) setBusy(false)
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent size="wide" className={styles.preview}>
        <DialogTitle>Export Final Video</DialogTitle>
        <DialogDescription>
          Select sections to stitch, in playback order. Download only—nothing is
          added to the library.
        </DialogDescription>
        <div className={styles.toolbar}>
          <Button
            disabled={busy}
            onClick={() =>
              selectionChanged(new Set(clips.map((clip) => clip.id)))
            }
          >
            Select all
          </Button>
          <Button disabled={busy} onClick={() => selectionChanged(new Set())}>
            Deselect all
          </Button>
          <span>
            {included.length} of {clips.length} sections · {duration.toFixed(1)}{' '}
            seconds
          </span>
        </div>
        <div className={styles.grid}>
          {clips.map((clip, index) => (
            <ExportTile
              key={clip.id}
              clip={clip}
              index={index}
              selected={selected.has(clip.id)}
              disabled={busy}
              onChange={(checked) => {
                const next = new Set(selected)
                if (checked) next.add(clip.id)
                else next.delete(clip.id)
                selectionChanged(next)
              }}
            />
          ))}
        </div>
        <p role="status" className={styles.status}>
          {status}
        </p>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <div className={styles.toolbar}>
          <Button onClick={onClose}>{busy ? 'Cancel export' : 'Close'}</Button>
          {result ? (
            <a
              className={styles.download}
              href={result}
              download="director-cut.mp4"
            >
              Download MP4
            </a>
          ) : (
            <Button
              variant="primary"
              disabled={busy || !included.length}
              onClick={() => {
                void prepare()
              }}
            >
              {busy ? 'Exporting…' : 'Export selected clips'}
            </Button>
          )}
        </div>
        <p className={styles.status}>
          Straight cuts, no audio. Skipping a section may create a visible jump.
          The selection is for this export only.
        </p>
      </DialogContent>
    </Dialog>
  )
}
