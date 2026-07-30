'use client'

import styles from './model-label.module.css'

interface ModelLabelProps {
  name: string
  left: number
  top: number
}

/** Which model made this image, pinned above its card in screen space. */
export function ModelLabel({ name, left, top }: ModelLabelProps) {
  return (
    <span className={styles.imageLabelOverlay} style={{ left, top }}>
      {name}
    </span>
  )
}
