'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ChevronUp, Minus, X } from 'lucide-react'
import { ProgressAnimation } from './progress-animation'
import styles from './run-overlay.module.css'
import type { RunSnapshot } from './types'
import { cx } from '#/lib/utils'

/** How long a success stays up before it takes itself away. */
const SUCCESS_LINGER_MS = 6000

interface RunOverlayProps {
  snap: RunSnapshot
  minimized: boolean
  onMinimize: () => void
  onExpand: () => void
  onDismiss: () => void
}

/**
 * One element in two sizes, not two components: the animation is mounted once
 * and only its box changes, so minimizing never restarts it (#725).
 *
 * Text is HTML, never drawn by the animation -- it has to be readable,
 * selectable and announced, and the animation has to survive failing to load.
 */
export function RunOverlay({
  snap,
  minimized,
  onMinimize,
  onExpand,
  onDismiss,
}: RunOverlayProps) {
  const [hovered, setHovered] = useState(false)
  const outcome = snap.end?.outcome
  const phase = outcome === 'success' ? 1 : outcome ? 2 : 0

  // A success clears itself; a failure or an empty run waits to be read.
  useEffect(() => {
    if (outcome !== 'success' || hovered) return
    const t = setTimeout(onDismiss, SUCCESS_LINGER_MS)
    return () => clearTimeout(t)
  }, [outcome, hovered, onDismiss])

  const count = snap.total ? `${snap.done} of ${snap.total}` : undefined
  const headline = snap.end?.text ?? snap.activity
  const latest = snap.snippets.at(0)

  return (
    <div
      className={cx(styles.root, minimized && styles.minimized)}
      role="region"
      aria-label={snap.title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {!minimized && <span className={styles.title}>{snap.title}</span>}

      <button
        type="button"
        className={styles.animationBox}
        onClick={minimized ? onExpand : undefined}
        tabIndex={minimized ? 0 : -1}
        aria-label={minimized ? 'Expand progress' : undefined}
        aria-hidden={!minimized}
      >
        <ProgressAnimation beat={snap.beat} count={snap.done} phase={phase} />
      </button>

      <div className={styles.body}>
        {/* Milestones only: the activity line and the outcome. Snippets arrive
            too often to announce. */}
        <p className={styles.activity} role="status" aria-live="polite">
          {headline}
          {count && !snap.end && <span className={styles.count}>{count}</span>}
          {snap.end?.href && (
            <Link
              href={snap.end.href}
              className={styles.view}
              onClick={onDismiss}
            >
              View
            </Link>
          )}
        </p>

        {minimized
          ? latest &&
            !snap.end && (
              <p key={latest.id} className={cx(styles.snippet, styles.arrive)}>
                <span className={styles.snippetLabel}>{latest.label}</span>
                {latest.text}
              </p>
            )
          : snap.snippets.length > 0 && (
              <ul className={styles.snippets}>
                {snap.snippets.map((s) => (
                  <li key={s.id} className={cx(styles.snippet, styles.arrive)}>
                    <span className={styles.snippetLabel}>{s.label}</span>
                    {s.text}
                  </li>
                ))}
              </ul>
            )}
      </div>

      <div className={styles.controls}>
        {minimized ? (
          <button
            type="button"
            className={styles.control}
            onClick={onExpand}
            aria-label="Expand"
          >
            <ChevronUp className={styles.controlIcon} />
          </button>
        ) : (
          <button
            type="button"
            className={styles.control}
            onClick={onMinimize}
            aria-label="Minimize"
            title="Minimize"
          >
            <Minus className={styles.controlIcon} />
          </button>
        )}
        {snap.end && (
          <button
            type="button"
            className={styles.control}
            onClick={onDismiss}
            aria-label="Dismiss"
          >
            <X className={styles.controlIcon} />
          </button>
        )}
      </div>
    </div>
  )
}
