import { useCallback, useRef, useState } from 'react'
import type { ImageOffset } from '../hooks/useOutpaintPage'

/** Minimum pixels of the image that must remain visible inside the frame */
const MIN_VISIBLE_PX = 25
/** Movement speed multiplier when dragging past the normal 0–1 range */
const RESISTANCE = 0.35

interface OutpaintPreviewProps {
  sourceImageUrl: string | null
  sourceTitle: string
  aspectRatio: string
  sourceNativeRatio: string | null
  offset: ImageOffset
  onOffsetChange: (offset: ImageOffset) => void
}

export function OutpaintPreview({
  sourceImageUrl,
  sourceTitle,
  aspectRatio,
  sourceNativeRatio,
  offset,
  onOffsetChange,
}: OutpaintPreviewProps) {
  const [targetW, targetH] = aspectRatio.split(':').map(Number)
  const targetRatio = targetW / targetH

  const [sourceW, sourceH] = (sourceNativeRatio ?? aspectRatio)
    .split(':')
    .map(Number)
  const sourceRatio = sourceW / sourceH

  // Determine which axes allow dragging
  const canDragX = targetRatio > sourceRatio // target is wider → horizontal extension
  const canDragY = targetRatio < sourceRatio // target is taller → vertical extension

  // Calculate the source image size relative to the frame
  // Source fills the frame on its constrained axis
  let imgWidthPct: number
  let imgHeightPct: number
  if (targetRatio > sourceRatio) {
    // target wider than source: source fills height, narrower in width
    imgHeightPct = 100
    imgWidthPct = (sourceRatio / targetRatio) * 100
  } else {
    // target taller than source: source fills width, shorter in height
    imgWidthPct = 100
    imgHeightPct = (targetRatio / sourceRatio) * 100
  }

  // Convert normalized offset (0-1) to CSS translate values
  // offset 0 = image at left/top edge, 0.5 = centered, 1 = right/bottom edge
  const maxTravelX = 100 - imgWidthPct // percentage of frame the image can move
  const maxTravelY = 100 - imgHeightPct
  const translateX = offset.x * maxTravelX
  const translateY = offset.y * maxTravelY

  const containerRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef<{ x: number; y: number; ox: number; oy: number }>({
    x: 0,
    y: 0,
    ox: 0.5,
    oy: 0.5,
  })

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!canDragX && !canDragY) return
      e.preventDefault()
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      setDragging(true)
      dragStart.current = {
        x: e.clientX,
        y: e.clientY,
        ox: offset.x,
        oy: offset.y,
      }
    },
    [canDragX, canDragY, offset],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const dx = e.clientX - dragStart.current.x
      const dy = e.clientY - dragStart.current.y

      let newX = dragStart.current.ox
      let newY = dragStart.current.oy

      if (canDragX && maxTravelX > 0) {
        const pxTravel = (maxTravelX / 100) * rect.width
        const rawX = dragStart.current.ox + dx / pxTravel

        // Apply resistance past the normal 0–1 range
        if (rawX < 0) {
          newX = rawX * RESISTANCE
        } else if (rawX > 1) {
          newX = 1 + (rawX - 1) * RESISTANCE
        } else {
          newX = rawX
        }

        // Hard clamp: at least MIN_VISIBLE_PX of image stays in frame
        const imgPx = (imgWidthPct / 100) * rect.width
        const minX = (MIN_VISIBLE_PX - imgPx) / pxTravel
        const maxXLimit = (rect.width - MIN_VISIBLE_PX) / pxTravel
        newX = Math.max(minX, Math.min(maxXLimit, newX))
      }

      if (canDragY && maxTravelY > 0) {
        const pxTravel = (maxTravelY / 100) * rect.height
        const rawY = dragStart.current.oy + dy / pxTravel

        if (rawY < 0) {
          newY = rawY * RESISTANCE
        } else if (rawY > 1) {
          newY = 1 + (rawY - 1) * RESISTANCE
        } else {
          newY = rawY
        }

        const imgPx = (imgHeightPct / 100) * rect.height
        const minY = (MIN_VISIBLE_PX - imgPx) / pxTravel
        const maxYLimit = (rect.height - MIN_VISIBLE_PX) / pxTravel
        newY = Math.max(minY, Math.min(maxYLimit, newY))
      }

      onOffsetChange({ x: newX, y: newY })
    },
    [
      dragging,
      canDragX,
      canDragY,
      maxTravelX,
      maxTravelY,
      imgWidthPct,
      imgHeightPct,
      onOffsetChange,
    ],
  )

  const onPointerUp = useCallback(() => {
    setDragging(false)
  }, [])

  const cursor =
    !canDragX && !canDragY ? 'default' : dragging ? 'grabbing' : 'grab'

  return (
    <div className="flex w-full justify-center">
      <div
        ref={containerRef}
        className="relative w-full max-h-[400px] rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 overflow-hidden"
        style={{
          aspectRatio: `${targetRatio}`,
          maxWidth: `${400 * targetRatio}px`,
        }}
      >
        {sourceImageUrl ? (
          <img
            src={sourceImageUrl}
            alt={sourceTitle}
            draggable={false}
            className="absolute select-none"
            style={{
              width: `${imgWidthPct}%`,
              height: `${imgHeightPct}%`,
              left: `${translateX}%`,
              top: `${translateY}%`,
              objectFit: 'cover',
              cursor,
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-xs text-muted-foreground">
              Select an image to preview
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
