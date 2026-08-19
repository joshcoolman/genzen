'use client'

import styles from './outpaint-run-card.module.css'
import type { OutpaintRun } from '../../use-view'
import { Thumbnail } from '#/components'
import { formatCents } from '#/lib/format'

/**
 * One run: the picture that went in, beside every model's answer to it.
 *
 * **The source is on the card, not just in the picker at the top of the page.**
 * The judgement here is comparative -- did it keep what was already there --
 * and by the third run the strip above has moved on to a different image.
 *
 * The cost is per result rather than per run, because the run's whole point is
 * that its models are priced differently. It is FAL's own figure, arriving
 * with the row, so it is blank until the row settles rather than showing an
 * estimate that a real number then contradicts.
 */
export function OutpaintRunCard({ run }: { run: OutpaintRun }) {
  return (
    <section className={styles.card}>
      <div className={styles.source}>
        <Thumbnail url={run.source.url} alt={run.source.title} compact />
        <span className={styles.ratio}>{run.aspectRatio}</span>
        {run.guidance && <p className={styles.guidance}>{run.guidance}</p>}
      </div>

      <div className={styles.results}>
        {run.results.map((result) => (
          <div key={result.recordId} className={styles.result}>
            <Thumbnail
              url={result.url}
              alt={`${run.source.title} at ${run.aspectRatio}`}
              status={
                result.status === 'completed' ? 'complete' : result.status
              }
              failedMessage={result.error ?? undefined}
              pendingBackgroundUrl={run.source.url}
              bottomRightBadge={result.modelName}
              compact
            />
            <span className={styles.cost}>
              {result.costCents == null
                ? '—'
                : formatCents(result.costCents, { estimate: true })}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
