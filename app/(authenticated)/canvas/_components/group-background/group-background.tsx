'use client'

import styles from './group-background.module.css'
import type { Bounds } from '../../_lib/geometry'

interface GroupBackgroundProps {
  groupId: string
  bounds: Bounds
  padding: number
}

/** The slab behind a group's members. Rendered before the cards so it sits
 *  underneath, and carries `data-group-id` so a click on the slab -- rather
 *  than on any one card -- selects the whole group. */
export function GroupBackground({
  groupId,
  bounds,
  padding,
}: GroupBackgroundProps) {
  return (
    <div
      data-group-id={groupId}
      className={styles.groupBackground}
      style={{
        left: bounds.x - padding,
        top: bounds.y - padding,
        width: bounds.w + padding * 2,
        height: bounds.h + padding * 2,
      }}
    />
  )
}
