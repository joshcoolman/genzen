/**
 * A rectangle drawn at a ratio, inside a fixed square box.
 *
 * Shared by the picker's list and Outpaint's grid: the shape is the thing
 * being chosen, so both surfaces have to draw it the same way or `16:9` and
 * `2:1` stop being distinguishable at a glance.
 */
const ICON_SIZE = 20

export function RatioIcon({ w, h }: { w: number; h: number }) {
  const ratio = w / h
  let iconW: number
  let iconH: number

  if (ratio >= 1) {
    iconW = ICON_SIZE
    iconH = ICON_SIZE / ratio
  } else {
    iconH = ICON_SIZE
    iconW = ICON_SIZE * ratio
  }

  iconW = Math.max(iconW, 8)
  iconH = Math.max(iconH, 8)

  const x = (ICON_SIZE - iconW) / 2
  const y = (ICON_SIZE - iconH) / 2

  return (
    <svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox={`0 0 ${ICON_SIZE} ${ICON_SIZE}`}
      fill="none"
    >
      <rect
        x={x + 0.75}
        y={y + 0.75}
        width={iconW - 1.5}
        height={iconH - 1.5}
        rx={2.5}
        stroke="currentColor"
        strokeWidth={1.5}
      />
    </svg>
  )
}
