'use client'

import styles from './order-row.module.css'
import { cx } from '#/lib/utils'

export type GroupOrder = 'date' | 'manual'

const LABELS: Record<GroupOrder, string> = {
  date: 'By date',
  manual: 'Manual',
}

/**
 * Which order the open group renders in (#505).
 *
 * **The same row, and the same register, as `ScopeRow`** -- which it stands in
 * for inside a group, where there is no origin scope. Both answer "what am I
 * looking at", both are a hairline with two or three words at the right end,
 * and in both the ink is the whole selected state. A second visual language
 * for the same slot would read as a different kind of thing arriving.
 *
 * **It appears only once an arrangement exists.** Dragging a card is what
 * creates one -- there is no mode to turn on first, which is #284's rule about
 * declaring an intention before you can touch the picture you are looking at.
 * So the control shows up as the result of the gesture rather than as a
 * precondition for it, and a group nobody has arranged has no row here at all.
 *
 * **Both directions are free.** Switching to By date keeps every hand-set
 * position, so this is a way of looking at the group rather than a way of
 * discarding work -- which is what lets it be a plain toggle with no confirm.
 *
 * `By date`, not `Newest first`: the newest/oldest direction is the toolbar's
 * own toggle and still applies here. This one chooses which *kind* of order is
 * in effect, and the toolbar hides its direction control while the answer is
 * Manual, where a direction has nothing to order.
 */
export function OrderRow({
  value,
  onChange,
}: {
  value: GroupOrder
  onChange: (order: GroupOrder) => void
}) {
  return (
    <div className={styles.row}>
      <span className={styles.label}>Order</span>
      {(['date', 'manual'] as const).map((order) => (
        <button
          key={order}
          type="button"
          className={cx(styles.item, order === value && styles.itemOn)}
          aria-pressed={order === value}
          onClick={() => onChange(order)}
        >
          {LABELS[order]}
        </button>
      ))}
    </div>
  )
}
