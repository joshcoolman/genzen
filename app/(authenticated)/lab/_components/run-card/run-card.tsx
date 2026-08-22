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
  note,
  input,
  output,
  outputs,
  placeholder,
  actions,
}: {
  label: string
  /** A second, quieter identity for the run — the Enhance grid names the
   *  instruction file that produced each card here, because one card per model
   *  means the page can no longer name a single file at the top (#465). */
  note?: string
  /** What was asked. Omitted where the input is an image rather than text. */
  input?: string
  output?: string
  /** For a run that emits several things, like variation prompts. */
  outputs?: Array<string>
  /** Shown in place of the output when there is none yet — a card still out, or
   *  one that failed. A card holds its place in the grid either way, so the
   *  comparison does not reflow as answers land (#465). */
  placeholder?: React.ReactNode
  /** What this run can be *done with*, beside its length readout (#433). A slot
   *  rather than a prop per verb: judging the output is what every page here
   *  shares, and what you then do with it is what none of them do the same. */
  actions?: React.ReactNode
}) {
  const all = outputs ?? (output != null ? [output] : [])

  return (
    <section className={styles.card}>
      <header className={styles.header}>
        <span className={styles.label}>{label}</span>
        <div className={styles.headerRight}>
          {note && <code className={styles.note}>{note}</code>}
          {all.length > 0 && (
            <span className={styles.count}>
              {all.length === 1
                ? `${output?.length ?? 0} chars`
                : `${all.length} results`}
            </span>
          )}
          {actions}
        </div>
      </header>

      {input && (
        <div className={styles.block}>
          <span className={styles.blockLabel}>In</span>
          <p className={styles.text}>{input}</p>
        </div>
      )}

      {all.length === 0 && placeholder}

      {all.map((value, i) => (
        <div key={i} className={styles.block}>
          {/* `Out` earns its place only where it separates the result from
              something else: an `In` above it, or the other outputs beside it.
              A card that is one result and nothing else reads it as the label
              of a field to fill in (#465). */}
          {(input != null || all.length > 1) && (
            <span className={styles.blockLabel}>
              {all.length === 1 ? 'Out' : `Out ${i + 1}`}
            </span>
          )}
          <div className={styles.outputRow}>
            <p className={styles.text}>{value}</p>
            <CopyButton text={value} />
          </div>
        </div>
      ))}
    </section>
  )
}
