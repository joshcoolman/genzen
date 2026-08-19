import styles from './run-card.module.css'
import { CopyButton } from '#/components'

/**
 * One run, kept on the page.
 *
 * **The input is shown beside the output on purpose.** Every question these
 * pages ask is comparative — too verbose *than what*, too specific *compared to
 * what* — and the dialogs these replaced showed only the result, which is most
 * of why they could not be tuned.
 *
 * Results accumulate rather than replacing each other, so two runs of the same
 * input against a changed instruction sit next to each other. They are lost on
 * navigation, deliberately: storage is a decision worth making later, and
 * something half-persisted is worse than something honestly temporary.
 */
export function RunCard({
  label,
  input,
  output,
  outputs,
}: {
  label: string
  /** What was asked. Omitted where the input is an image rather than text. */
  input?: string
  output?: string
  /** For a run that emits several things, like variation prompts. */
  outputs?: Array<string>
}) {
  const all = outputs ?? (output != null ? [output] : [])

  return (
    <section className={styles.card}>
      <header className={styles.header}>
        <span className={styles.label}>{label}</span>
        <span className={styles.count}>
          {all.length === 1
            ? `${output?.length ?? 0} chars`
            : `${all.length} results`}
        </span>
      </header>

      {input && (
        <div className={styles.block}>
          <span className={styles.blockLabel}>In</span>
          <p className={styles.text}>{input}</p>
        </div>
      )}

      {all.map((value, i) => (
        <div key={i} className={styles.block}>
          <span className={styles.blockLabel}>
            {all.length === 1 ? 'Out' : `Out ${i + 1}`}
          </span>
          <div className={styles.outputRow}>
            <p className={styles.text}>{value}</p>
            <CopyButton text={value} />
          </div>
        </div>
      ))}
    </section>
  )
}
