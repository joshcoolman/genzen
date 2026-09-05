'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, Save } from 'lucide-react'
import { uploadMedia } from '../../_lib/upload'
import { exportCut, selectedClips } from '../../export-cut'
import { ExportTile } from '../export-tile/export-tile'
import styles from './export-preview.module.css'
import type { Clip } from '../../clips'
import type { StoredClip } from '../../_lib/types'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Input,
} from '#/components'

export function ExportPreview({
  clips,
  source,
  sessionId,
  onSaved,
  onClose,
}: {
  clips: Array<Clip>
  source: Array<StoredClip>
  sessionId: string
  onSaved: () => void
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
  const resultBlob = useRef<Blob | null>(null)
  const saveId = useRef<string | null>(null)
  const saving = useRef(false)
  const [name, setName] = useState('Director cut')
  const [saved, setSaved] = useState(false)
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
    resultBlob.current = null
    saveId.current = null
    setSaved(false)
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
      resultBlob.current = blob
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
  async function save() {
    if (saving.current || !resultBlob.current || saved || !name.trim()) return
    saving.current = true
    setBusy(true)
    setError(null)
    saveId.current ??= crypto.randomUUID()
    try {
      setStatus('Saving export...')
      await uploadMedia(sessionId, resultBlob.current, {
        id: saveId.current,
        name: name.trim(),
        source: source.filter((clip) => selected.has(clip.id)),
      })
      setSaved(true)
      setStatus('Export saved.')
      onSaved()
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Export could not be saved.',
      )
      setStatus(
        'Not saved. The rendered video is still available to retry or download.',
      )
    } finally {
      saving.current = false
      setBusy(false)
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving.current) onClose()
      }}
    >
      <DialogContent size="wide" className={styles.preview}>
        <DialogTitle>Export Final Video</DialogTitle>
        <DialogDescription>
          {included.length} selected sections
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
          <Button disabled={saving.current} onClick={onClose}>
            {busy ? 'Cancel export' : 'Close'}
          </Button>
          {result ? (
            <>
              <Input
                aria-label="Export name"
                value={name}
                maxLength={120}
                disabled={busy || saved}
                onChange={(event) => setName(event.target.value)}
              />
              <Button
                variant="primary"
                disabled={busy || saved || !name.trim()}
                onClick={() => void save()}
              >
                <Save size={16} />
                {saved ? 'Saved' : 'Save export'}
              </Button>
              <a
                className={styles.download}
                href={result}
                download="director-cut.mp4"
              >
                <Download size={16} />
                Download MP4
              </a>
            </>
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
