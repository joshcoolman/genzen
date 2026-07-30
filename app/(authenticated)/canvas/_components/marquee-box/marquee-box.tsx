'use client'

import styles from './marquee-box.module.css'

interface MarqueeBoxProps {
  left: number
  top: number
  width: number
  height: number
}

/** The drag-to-select rectangle. */
export function MarqueeBox(props: MarqueeBoxProps) {
  return <div className={styles.marquee} style={props} />
}
