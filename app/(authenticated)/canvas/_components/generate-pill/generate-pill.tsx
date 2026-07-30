'use client'

import { Sparkles } from 'lucide-react'
import styles from './generate-pill.module.css'

interface GeneratePillProps {
  left: number
  top: number
  /** Drives the tooltip: one image is a source, several are references. */
  count: number
  onClick: () => void
}

/** Generate-from-selection, floating just below the selection. */
export function GeneratePill({ left, top, count, onClick }: GeneratePillProps) {
  return (
    <button
      className={styles.onImageGenerate}
      style={{ left, top }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      title={
        count > 1 ? `Generate from ${count} images` : 'Generate from image'
      }
    >
      <Sparkles size={15} />
      <span>Generate</span>
    </button>
  )
}
