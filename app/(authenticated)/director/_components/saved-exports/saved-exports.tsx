import { useRef, useState } from 'react'
import { Download, Pencil, Trash2 } from 'lucide-react'
import {
  changeExportName,
  loadExports,
  removeExport,
} from '../../_actions/exports.action'
import { mediaUrl } from '../../_lib/types'
import styles from './saved-exports.module.css'
import type { SavedExport } from '../../_lib/types'
import { Button, ConfirmDialog, EmptyState, Input } from '#/components'

export function SavedExports({
  sessionId,
  items,
  onChange,
}: {
  sessionId: string
  items: Array<SavedExport>
  onChange: (items: Array<SavedExport>) => void
}) {
  const [deleting, setDeleting] = useState<SavedExport | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const working = useRef(false)
  async function run(action: () => Promise<void>) {
    if (working.current) return
    working.current = true
    setBusy(true)
    setError(null)
    try {
      await action()
      onChange(await loadExports(sessionId))
      setRenaming(null)
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Export could not be updated.',
      )
    } finally {
      setDeleting(null)
      setBusy(false)
      working.current = false
    }
  }
  return (
    <>
      {error && <p role="alert">{error}</p>}
      {!items.length ? (
        <EmptyState title="No saved exports" />
      ) : (
        <div className={styles.grid}>
          {items.map((item) => (
            <article key={item.id} className={styles.item}>
              <video
                className={styles.video}
                src={mediaUrl(item.media_id)}
                poster={mediaUrl(item.thumbnail_id)}
                controls
                playsInline
                preload="none"
              />
              <div className={styles.caption}>
                {renaming === item.id ? (
                  <form
                    className={styles.actions}
                    onSubmit={(event) => {
                      event.preventDefault()
                      void run(() => changeExportName(sessionId, item.id, name))
                    }}
                  >
                    <Input
                      autoFocus
                      aria-label="Export name"
                      value={name}
                      maxLength={120}
                      onChange={(event) => setName(event.target.value)}
                    />
                    <Button type="submit" disabled={busy || !name.trim()}>
                      Save
                    </Button>
                    <Button disabled={busy} onClick={() => setRenaming(null)}>
                      Cancel
                    </Button>
                  </form>
                ) : (
                  <h2>{item.name}</h2>
                )}
                <p>
                  {item.source.length} sections · {item.duration.toFixed(1)}s ·{' '}
                  <time dateTime={item.created_at}>
                    {new Date(item.created_at).toISOString().slice(0, 10)}
                  </time>
                </p>
                <div className={styles.actions}>
                  <a
                    href={mediaUrl(item.media_id)}
                    download={`${item.name.replace(/[^a-zA-Z0-9 _-]/g, '').trim() || 'director-export'}.mp4`}
                  >
                    <Download size={16} /> Download
                  </a>
                  <Button
                    disabled={busy}
                    title="Rename export"
                    aria-label={`Rename ${item.name}`}
                    onClick={() => {
                      setRenaming(item.id)
                      setName(item.name)
                    }}
                  >
                    <Pencil size={16} />
                  </Button>
                  <Button
                    disabled={busy}
                    title="Delete export"
                    aria-label={`Delete ${item.name}`}
                    onClick={() => setDeleting(item)}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={!!deleting}
        title="Delete export?"
        message={`Permanently delete "${deleting?.name ?? ''}". The session and its clips will remain.`}
        confirmLabel="Delete export"
        onConfirm={() => {
          if (deleting) void run(() => removeExport(sessionId, deleting.id))
        }}
        onCancel={() => setDeleting(null)}
      />
    </>
  )
}
