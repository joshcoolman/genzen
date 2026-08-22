import styles from './lab-page.module.css'
import { PageHeader } from '#/components'
import { cx } from '#/lib/utils'

/**
 * The frame every lab page shares.
 *
 * Two things it carries that an ordinary route would not:
 *
 * - **the question being asked.** Each of these pages exists to answer one, and
 *   they are different questions about different inputs — which is why they are
 *   three pages and not one surface with three buttons (#424).
 * - **the file that steers it.** The whole point of the lab is that you change
 *   an instruction and look at what happens, so the page says which file to
 *   open. Every one of them is markdown since #322. Optional: an experiment
 *   that sends nothing to a model has no instruction to name, and printing an
 *   empty line for one would say there is a file to go and edit.
 */
export function LabPage({
  title,
  question,
  instructionFile,
  error,
  wide,
  children,
}: {
  title: string
  question: string
  instructionFile?: string
  error?: string | null
  /**
   * Drop the reading-width cap, for a page that lays out its own columns.
   *
   * The cap is right for the default shape here — one stacked column of prose,
   * where a full-width line is a line you lose your place in. It is wrong the
   * moment a page puts a rail beside that column: the cap then applies to both
   * together, so the rail eats the reading width rather than sitting beside it,
   * and collapsing the nav to gain space gains none.
   */
  wide?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={cx(styles.page, wide && styles.pageWide)}>
      <PageHeader title={title} description={question} />
      {instructionFile && (
        <p className={styles.instruction}>
          Steered by <code className={styles.file}>{instructionFile}</code>
        </p>
      )}
      {error && <p className={styles.error}>{error}</p>}
      {children}
    </div>
  )
}
