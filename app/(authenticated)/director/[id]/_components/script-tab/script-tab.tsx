'use client'

import { dialogueText, runSeconds } from '../../script'
import styles from './script-tab.module.css'
import type { ScriptLine } from '../../script'
import { CopyButton, EmptyState } from '#/components'

/**
 * The session's dialogue, in run order (#690).
 *
 * **Conservative on purpose: the lines and nothing else.** The clip prompts
 * also carry a scene, written once per answer, and a per-clip action -- real
 * scene direction, cleanly separable, and both deliberately left out of this
 * first pass. The question they answer is whether the list reads as a story
 * before anything is layered on it, and that is only answerable by looking at
 * the bare thing.
 *
 * **It follows the run.** The numbers are positions in the work area, so a
 * burst removed there renumbers everything after it and drops out of here --
 * the script says what the film says rather than what was written.
 *
 * **The duration is the second half of the brief.** What was said and how long
 * it took are the two facts a re-run has to hit, and they are the two that
 * survive swapping the character and the place -- which the action and the
 * scene, being about this bear in this forest, do not.
 */
export function ScriptTab({ lines }: { lines: Array<ScriptLine> }) {
  if (lines.length === 0) {
    return (
      <div className={styles.empty}>
        <EmptyState title="Nothing said yet">
          The run has no clips, so there is no dialogue to read.
        </EmptyState>
      </div>
    )
  }

  const spoken = lines.filter((line) => line.spoken).length
  const total = runSeconds(lines)

  return (
    <div className={styles.tab}>
      <div className={styles.bar}>
        <p className={styles.count}>
          {spoken} {spoken === 1 ? 'line' : 'lines'}
          {total > 0 && <span className={styles.total}> · {total}s</span>}
        </p>
        {/* The whole thing at once, numbered as it reads. */}
        <CopyButton text={dialogueText(lines)} />
      </div>
      <ol className={styles.script}>
        {lines.map((line) => (
          <li key={line.clipId} className={styles.line}>
            <span className={styles.number}>{line.number}</span>
            {line.spoken ? (
              <p className={styles.spoken}>{line.line}</p>
            ) : (
              /* A clip whose prompt carried no quoted line -- a hand-typed
                 one. It keeps its place and its number: it is still in the
                 film, and a script that quietly skipped it would renumber the
                 lines around a cut that did not happen. */
              <p className={styles.silent}>No dialogue in this clip.</p>
            )}
            {/* What this clip actually ran, off the row. A measurement rather
                than a recommendation: a session made before #685 carries
                durations the model chose, so this says what the film is and
                not what these words should run to. */}
            <span className={styles.seconds}>
              {line.seconds === null ? '' : `${line.seconds}s`}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
