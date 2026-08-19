'use client'

import styles from './selection-bounds.module.css'

interface SelectionBoundsProps {
  left: number
  top: number
  width: number
  height: number
}

/** The blue rectangle around whatever is selected -- one card or many. This is
 *  the only selection indicator; cards themselves are not restyled. */
export function SelectionBounds(props: SelectionBoundsProps) {
  return <div className={styles.groupBounds} style={props} />
}
