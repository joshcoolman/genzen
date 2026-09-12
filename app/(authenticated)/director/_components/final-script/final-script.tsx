import { scriptText } from '../../final-script'
import styles from './final-script.module.css'
import type { FinalCutSummary } from '../../_lib/final-cut'
import { CopyButton } from '#/components'

/**
 * A Script job's result (#634): the plan's framing, then one card per
 * section with the full H3 multi-shot text and its own copy. Long on purpose
 * -- it is read top to bottom and pasted into Video one section at a time,
 * so nothing is collapsed and the duration sits beside each copy so the
 * clip is generated at the length the section was written for.
 */
export function FinalScript({
  script,
  expectedSections,
}: {
  script: NonNullable<FinalCutSummary['script']>
  /** How many the plan called for; fewer means the writer is still going. */
  expectedSections?: number
}) {
  return (
    <div className={styles.root}>
      <div className={styles.head}>
        <div className={styles.meta}>
          <p className={styles.story}>{script.story}</p>
          <p className={styles.line}>
            <span className={styles.label}>Continuity</span>
            {script.continuity}
          </p>
          <p className={styles.line}>
            <span className={styles.label}>Style</span>
            {script.style}
          </p>
          <p className={styles.line}>
            <span className={styles.label}>Shape</span>
            {script.aspectRatio}
          </p>
        </div>
        <div className={styles.copyAll}>
          <CopyButton text={scriptText(script)} />
          <span className={styles.note}>Copy the whole script</span>
        </div>
      </div>
      <ol className={styles.sections}>
        {script.sections.map((section) => (
          <li key={section.index} className={styles.section}>
            <div className={styles.sectionHead}>
              <h4>
                Section {section.index + 1}
                <span className={styles.duration}> · {section.duration}s</span>
              </h4>
              <span className={styles.sources}>
                from {section.sources.map((source) => source + 1).join(', ')}
              </span>
              <CopyButton text={section.text} />
            </div>
            <pre className={styles.text}>{section.text}</pre>
          </li>
        ))}
        {expectedSections !== undefined &&
          script.sections.length < expectedSections && (
            <li className={styles.pending}>
              Writing section {script.sections.length + 1} of {expectedSections}
              ...
            </li>
          )}
      </ol>
    </div>
  )
}
