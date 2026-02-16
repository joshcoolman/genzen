/**
 * Hue Slider
 *
 * Horizontal slider showing full hue spectrum (0-360)
 * with draggable thumb positioned at current hue.
 */

import { useRef, useCallback, useEffect, useState } from 'react'

interface HueSliderProps {
  currentHue: number // 0-360
  onChange: (newHue: number) => void
}

export function HueSlider({ currentHue, onChange }: HueSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const getHueFromPosition = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return currentHue
      const rect = trackRef.current.getBoundingClientRect()
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width))
      return (x / rect.width) * 360
    },
    [currentHue],
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setIsDragging(true)
      onChange(getHueFromPosition(e.clientX))
    },
    [getHueFromPosition, onChange],
  )

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return
      onChange(getHueFromPosition(e.clientX))
    },
    [isDragging, getHueFromPosition, onChange],
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  // Position thumb at current hue (0-360 mapped to 0-100%)
  const thumbPosition = (currentHue / 360) * 100

  return (
    <div className="w-full py-2">
      <div
        ref={trackRef}
        onMouseDown={handleMouseDown}
        className="relative h-4 rounded-sm cursor-pointer"
        style={{
          background: `linear-gradient(to right,
            hsl(0, 100%, 50%),
            hsl(60, 100%, 50%),
            hsl(120, 100%, 50%),
            hsl(180, 100%, 50%),
            hsl(240, 100%, 50%),
            hsl(300, 100%, 50%),
            hsl(360, 100%, 50%)
          )`,
        }}
      >
        {/* Thumb indicator */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-6 bg-white rounded-sm border-2 border-gray-800 shadow-md pointer-events-none"
          style={{ left: `${thumbPosition}%` }}
        />
      </div>
    </div>
  )
}
