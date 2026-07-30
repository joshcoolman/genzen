'use client'

import styles from './canvas-surface.module.css'
import type { Transform } from '../../_lib/types'
import { cx } from '#/lib/utils'

interface CanvasSurfaceProps {
  containerRef: React.RefObject<HTMLDivElement | null>
  transform: Transform
  /** Space is held: the whole surface is a pan handle. */
  panMode: boolean
  /** Rendered inside the transformed plane, in canvas coordinates. */
  plane: React.ReactNode
  /** Rendered over the plane, in screen coordinates. */
  children: React.ReactNode
  onPointerDown: (e: React.PointerEvent) => void
  onPointerMove: (e: React.PointerEvent) => void
  onPointerUp: (e: React.PointerEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  onContextMenu: (e: React.MouseEvent) => void
}

/** The interactive frame: a fixed full-bleed surface holding one transformed
 *  plane plus screen-space overlays.
 *
 *  The frame *is* the design here, so it is a named component rather than a
 *  module on the view -- the same reason Login's centred column is
 *  `centered-panel` (docs/reference/route-shape.md).
 *
 *  Two coordinate systems meet at this boundary and the split is deliberate:
 *  anything that must stay legible at any zoom (labels, spinners, the Generate
 *  pill) is a child, positioned in screen space; anything that belongs to the
 *  arrangement is in `plane` and scales with it. */
export function CanvasSurface({
  containerRef,
  transform,
  panMode,
  plane,
  children,
  ...handlers
}: CanvasSurfaceProps) {
  return (
    <div
      ref={containerRef}
      className={cx(styles.canvas, panMode && styles.panMode)}
      tabIndex={0}
      {...handlers}
    >
      <div
        className={styles.inner}
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: '0 0',
        }}
      >
        {plane}
      </div>
      {children}
    </div>
  )
}
