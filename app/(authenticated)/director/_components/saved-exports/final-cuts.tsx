import { useState } from 'react'
import {
  Clapperboard,
  Download,
  FileText,
  Film,
  LoaderCircle,
  RotateCw,
  Square,
  Trash2,
} from 'lucide-react'
import { FINAL_SOURCE_SECONDS } from '../../_lib/final-cut'
import { mediaUrl } from '../../_lib/types'
import { FinalScript } from '../final-script/final-script'
import { renderEstimate } from '../../final-script'
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
  const [rendering, setRendering] = useState<FinalCutSummary | null>(null)
  const estimate = rendering?.script
    ? renderEstimate(rendering.script.sections)
    : null
  const items = cuts.items.filter((item) => item.export_id === exportId)
  const active = cuts.items.some((item) => item.occupied)
  const eligible = duration <= FINAL_SOURCE_SECONDS
  return (
    <section className={styles.finals} aria-label="Final cuts">
      <div className={styles.actions}>
        <Button
          disabled={!cuts.loaded || cuts.busy || active || !eligible}
          title={
            eligible
              ? 'Generate a paid Final Cut of up to 2 minutes'
              : 'Final Cut accepts rough exports up to 3 minutes'
          }
          onClick={() => cuts.start(exportId)}
        >
          <Film size={16} /> Final Cut
        </Button>
        {/* Script (#634): the same planning, then each shot written as a
            copyable H3 multi-shot prompt, and nothing sent to FAL. Text you
            paste into Video one section at a time, on the same row shape and
            the same one-at-a-time rule as a render. */}
        <Button
          disabled={!cuts.loaded || cuts.busy || active || !eligible}
          title={
            eligible
              ? 'Write the finished film as copyable section prompts, no video'
              : 'Script accepts rough exports up to 3 minutes'
          }
          onClick={() => cuts.start(exportId, 'script')}
        >
          <FileText size={16} /> Script
        </Button>
        <span className={styles.note}>
          {eligible
            ? 'Final Cut is paid generation. Script is text only.'
            : '3 minute source limit'}
        </span>
      </div>
      {items.map((item, index) => (
        <div className={styles.final} key={item.id}>
          <h3>
            {index + 1}. {item.name}
            {item.kind === 'script' && (
              <span className={styles.note}> · script</span>
            )}
          </h3>
          {item.script && (
            <FinalScript
              script={item.script}
              expectedSections={item.sectionCount ?? undefined}
            />
          )}
          {item.kind === 'script' && item.status === 'complete' && (
            <div className={styles.actions}>
              {/* The hand-run made one button (#640): each section from the
                  last frame of the one before, stitched with sound. Paid and
                  minutes long, so it confirms with both numbers first. */}
              <Button
                variant="primary"
                disabled={cuts.busy || active}
                title="Generate every section from the previous one's last frame and stitch the film"
                onClick={() => setRendering(item)}
              >
                <Clapperboard size={16} /> Generate Final Cut video
              </Button>
              <span className={styles.note}>Paid. Runs for minutes.</span>
            </div>
          )}
          {item.kind === 'render' && item.fromScript && (
            <p className={styles.note}>Rendered from the script.</p>
          )}
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
        open={!!rendering}
        title="Generate the Final Cut video?"
        message={
          estimate
            ? `${rendering?.script?.sections.length} sections, ${estimate.seconds} seconds of video on MiniMax H3 Max Turbo at 480P. Estimated cost $${estimate.usd.toFixed(2)}, and roughly ${estimate.minutes} minute${estimate.minutes === 1 ? '' : 's'} to finish. Each section starts on the previous one's last frame; the clips are stitched with their sound. You can leave the page.`
            : ''
        }
        confirmLabel="Generate"
        onCancel={() => setRendering(null)}
        onConfirm={() => {
          if (rendering) cuts.render(exportId, rendering.id)
          setRendering(null)
        }}
      />
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
