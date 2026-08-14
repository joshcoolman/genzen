'use client'

import styles from './group-members.module.css'
import { imageUrl } from '#/lib/image-url'

interface GroupMembersProps {
  name: string
  /** Every picture in the group, newest first. Undefined while the read is in
   *  flight -- a group opened for the first time. */
  ids: Array<string> | undefined
  count: number
  onCollapse: () => void
}

/**
 * A group's whole contents, disclosed under its card (#352).
 *
 * **Full width, spanning every column**, which is the entire reason this is a
 * cell of its own rather than the card growing. Grown in place, a group of
 * fifty makes its own grid row twelve swatches tall and leaves the cards beside
 * it in an empty band -- and at a 200px card, five across is a 33px thumbnail,
 * which is texture rather than orientation. Across the full width the same
 * fifty are ten or twelve columns at a size you can recognise, which is what
 * "orient without going into the group" needs.
 *
 * Deliberately inert: these are pictures to look at, not targets. Clicking one
 * to open it is a different feature, and the group is one click away for
 * anything more than looking.
 */
export function GroupMembers({
  name,
  ids,
  count,
  onCollapse,
}: GroupMembersProps) {
  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <span className={styles.title}>{name}</span>
        <button type="button" className={styles.close} onClick={onCollapse}>
          Collapse
        </button>
      </div>

      <div className={styles.grid}>
        {/* Placeholders at the count the card already knows, so opening a group
            lays out at its real height immediately instead of snapping taller
            when the ids land and shoving the grid below it. */}
        {(ids ?? Array.from({ length: count }, () => null)).map((id, i) => (
          <span
            key={id ?? `loading-${i}`}
            className={id ? styles.member : styles.memberLoading}
            style={
              id
                ? { backgroundImage: `url(${imageUrl(id, 'thumb')})` }
                : undefined
            }
            aria-hidden="true"
          />
        ))}
      </div>
    </div>
  )
}
