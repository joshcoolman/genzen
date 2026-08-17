'use client'

import { useEffect, useState } from 'react'
import styles from './zoom-readout.module.css'

interface ZoomReadoutProps {
  zoom: number
  gridRef: React.RefObject<HTMLDivElement | null>
}

/**
 * TEMPORARY (#403). Delete this folder and its one line in `image-gallery`.
 *
 * Here to answer one question empirically: which zoom stops actually change
 * anything. A step only reads as a change when it crosses a column-count
 * threshold, and where those sit depends on the window width -- so the column
 * count, not the percentage, is the number worth watching.
 *
 * Counted from the computed `grid-template-columns` rather than derived from
 * the width, because that is what the browser actually resolved `auto-fill` to.
 */
export function ZoomReadout({ zoom, gridRef }: ZoomReadoutProps) {
  const [columns, setColumns] = useState(0)

  useEffect(() => {
    const el = gridRef.current
    if (!el) return

    const measure = () => {
      const tracks = getComputedStyle(el).gridTemplateColumns
      setColumns(tracks === 'none' ? 0 : tracks.split(' ').length)
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [gridRef, zoom])

  return (
    <div className={styles.readout}>
      {Math.round(zoom * 100)}% · {columns} cols
    </div>
  )
}
