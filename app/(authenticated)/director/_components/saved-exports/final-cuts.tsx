import { useState } from 'react'
import {
  Download,
  Film,
  LoaderCircle,
  RotateCw,
  Square,
  Trash2,
} from 'lucide-react'
import { FINAL_CUT_SECONDS } from '../../_lib/final-cut'
import { mediaUrl } from '../../_lib/types'
import styles from './saved-exports.module.css'
import type { FinalCutSummary } from '../../_lib/final-cut'
import type { useFinalCuts } from './use-final-cuts'
import { Button, ConfirmDialog } from '#/components'

export function FinalCuts({
  exportId,
  duration,
  cuts,
}: {
  exportId: string
  duration: number
  cuts: ReturnType<typeof useFinalCuts>
}) {
  const [deleting, setDeleting] = useState<FinalCutSummary | null>(null)
  const items = cuts.items.filter((item) => item.export_id === exportId)
  const active = cuts.items.some((item) => item.occupied)
  const eligible = duration <= FINAL_CUT_SECONDS
  return (
    <section className={styles.finals} aria-label="Final cuts">
      <div className={styles.actions}>
        <Button
          disabled={!cuts.loaded || cuts.busy || active || !eligible}
          title={
            eligible
              ? 'Generate a new paid Final Cut'
              : 'Final Cut supports exports up to 2 minutes'
          }
          onClick={() => cuts.start(exportId)}
        >
          <Film size={16} /> Final Cut
        </Button>
        <span className={styles.note}>
          {eligible ? 'Paid generation' : '2 minute limit'}
        </span>
      </div>
      {items.map((item, index) => (
        <div className={styles.final} key={item.id}>
          <h3>
            {index + 1}. {item.name}
          </h3>
          {item.output && (
            <video
              className={styles.video}
              src={mediaUrl(item.output.mediaId)}
              poster={mediaUrl(item.output.thumbnailId)}
              controls
              playsInline
              preload="none"
            />
          )}
          <div className={styles.actions}>
            <span className={styles.status} role="status">
              {(item.status === 'queued' || item.status === 'running') && (
                <LoaderCircle size={14} className={styles.spinner} />
              )}
              {item.stage}
              {item.output ? ` · ${item.output.duration.toFixed(1)}s` : ''}
            </span>
            {item.output && (
              <a
                href={mediaUrl(item.output.mediaId)}
                download={`director-final-cut-${index + 1}.mp4`}
                title="Download Final Cut"
                aria-label={`Download Final Cut ${index + 1}`}
              >
                <Download size={16} />
              </a>
            )}
            {item.resumable && (
              <Button
                disabled={cuts.busy || active}
                title="Resume saved progress"
                onClick={() => {
                  void cuts.manage(item.id, 'resume')
                }}
              >
                <RotateCw size={16} /> Resume
              </Button>
            )}
            {item.status === 'queued' || item.status === 'running' ? (
              <Button
                disabled={cuts.busy}
                title="Stop after the current request; accepted provider requests may still be charged"
                aria-label={`Stop Final Cut ${index + 1}`}
                onClick={() => {
                  void cuts.manage(item.id, 'stop')
                }}
              >
                <Square size={14} />
              </Button>
            ) : (
              <Button
                disabled={cuts.busy || item.occupied}
                title="Delete Final Cut"
                aria-label={`Delete Final Cut ${index + 1}`}
                onClick={() => setDeleting(item)}
              >
                <Trash2 size={16} />
              </Button>
            )}
          </div>
          {item.status === 'failed' && (
            <p role="alert">{item.error || 'Final Cut failed.'}</p>
          )}
          {item.status === 'cancelled' && item.occupied && (
            <p>Stopping. Accepted requests may still be charged.</p>
          )}
        </div>
      ))}
      <ConfirmDialog
        open={!!deleting}
        title="Delete Final Cut?"
        message="Permanently delete this version and its generated assets. Your source export and other versions will remain."
        confirmLabel="Delete Final Cut"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting)
            void cuts
              .manage(deleting.id, 'delete')
              .then(() => setDeleting(null))
        }}
      />
    </section>
  )
}
