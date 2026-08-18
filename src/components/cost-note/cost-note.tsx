import styles from './cost-note.module.css'
import { formatCents } from '#/lib/format'

export interface CostNoteProps {
  /** Cents this submit is expected to cost. Null renders no figure at all. */
  cents: number | null
  /** How many things the figure does not cover. Above zero it says so rather
   *  than letting a partial total read as a whole one. */
  unpriced?: number
  /** The spec beside the price: the model, the resolution, whatever names what
   *  you are about to buy. */
  children?: React.ReactNode
}

/**
 * The line under Generate: what this click costs, and what it buys.
 *
 * **Under the button, not inside it** (#416). Video carried its price in the
 * button label, so the control changed width as you changed the duration, and
 * the label read `Generate $0.72` — an act named after its price. Images
 * carried a count and no price at all, on the route where a stepper, a prompt
 * list and multi-select models multiply at once. So the button says the act on
 * both routes and the money moved here, where it can carry the `~`, the model
 * and a caveat without crowding a control.
 *
 * One component for both because they must not drift: five copies of the money
 * *formatter* had already produced two different answers before this existed.
 * An app whose promise is that its figures match FAL's cannot have two places
 * deciding how a figure looks.
 */
export function CostNote({ cents, unpriced = 0, children }: CostNoteProps) {
  return (
    <p className={styles.note}>
      {cents != null && (
        // Always an estimate. Nothing here has run yet, and FAL reports no cost
        // even after it has.
        <span className={styles.cost}>
          {formatCents(cents, { estimate: true })}
        </span>
      )}
      {children != null && <span className={styles.spec}>{children}</span>}
      {unpriced > 0 && (
        // A total that silently omits a model is the exact failure this app
        // exists not to have. Say the figure is short, and by how many.
        <span className={styles.caveat}>
          {unpriced} model{unpriced === 1 ? '' : 's'} unpriced
        </span>
      )}
    </p>
  )
}
