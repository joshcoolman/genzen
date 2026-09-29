'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { changeCutPronunciation } from '../../../_actions/rerun.action'
import { cutProgressLabel } from '../../../_lib/cut-job'
import styles from './cut-progress.module.css'
import type { CutProgress as Progress } from '../../../_lib/cut-job'
import { Button, Textarea, toast } from '#/components'

export function CutProgress({
  job,
  sessionId,
  busy,
  onCancel,
  onRetry,
}: {
  job: Progress
  sessionId: string
  busy: boolean
  onCancel: () => void
  onRetry: () => void
}) {
  const router = useRouter()
  const [editing, setEditing] = useState<string | null>(null)
  const [words, setWords] = useState('')
  const [saving, setSaving] = useState(false)
  const save = async () => {
    if (!editing) return
    setSaving(true)
    try {
      await changeCutPronunciation(sessionId, job.id, editing, words)
      setEditing(null)
      router.refresh()
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : 'Could not save pronunciation.',
      )
    } finally {
      setSaving(false)
    }
  }
  return (
    <section className={styles.panel} aria-label="Cut progress">
      <div className={styles.heading}>
        <span role="status" aria-live="polite">
          {cutProgressLabel(job)}
        </span>
        {['active', 'failed', 'blocked'].includes(job.status) && (
          <Button size="sm" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
        )}
        {job.status === 'failed' && (
          <Button size="sm" disabled={busy} onClick={onRetry}>
            Retry
          </Button>
        )}
      </div>
      {job.error && job.status !== 'cancelled' && (
        <p className={styles.error} role="alert">
          {job.error}
        </p>
      )}
      {job.data.shots.some((shot) => shot.spoken) && (
        <details className={styles.pronunciation}>
          <summary>Pronunciation</summary>
          {job.data.shots.map(
            (shot, index) =>
              shot.spoken && (
                <div key={shot.id} className={styles.line}>
                  <p>
                    <strong>Clip {index + 1}</strong>: {shot.spoken}
                  </p>
                  {shot.spokenOverride && (
                    <p>Spoken as: {shot.spokenOverride}</p>
                  )}
                  {editing === shot.id ? (
                    <>
                      <Textarea
                        aria-label={`Spoken wording for clip ${index + 1}`}
                        value={words}
                        maxLength={4000}
                        onChange={(event) => setWords(event.target.value)}
                      />
                      <Button
                        size="sm"
                        loading={saving}
                        onClick={() => void save()}
                      >
                        Save pronunciation
                      </Button>
                      <Button
                        size="sm"
                        disabled={saving}
                        onClick={() => setEditing(null)}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    job.status === 'active' &&
                    job.data.phase === 'generate' &&
                    shot.state === 'waiting' && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setEditing(shot.id)
                          setWords(shot.spokenOverride ?? shot.spoken)
                        }}
                      >
                        Edit pronunciation
                      </Button>
                    )
                  )}
                </div>
              ),
          )}
        </details>
      )}
    </section>
  )
}
