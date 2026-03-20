import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface AspectRatioSelectProps {
  orientation: 'landscape' | 'portrait'
  aspectRatio: string
  onOrientationChange: (o: 'landscape' | 'portrait') => void
  onAspectRatioChange: (ratio: string) => void
  ratios?: { landscape?: Array<string>; portrait?: Array<string> }
  disabled?: boolean
  className?: string
}

const ALL_RATIOS = [
  { label: '16:9', w: 16, h: 9, group: 'Landscape' },
  { label: '2:1', w: 2, h: 1, group: 'Landscape' },
  { label: '3:2', w: 3, h: 2, group: 'Landscape' },
  { label: '4:3', w: 4, h: 3, group: 'Landscape' },
  { label: '21:9', w: 21, h: 9, group: 'Landscape' },
  { label: '5:4', w: 5, h: 4, group: 'Landscape' },
  { label: '1:1', w: 1, h: 1, group: 'Square' },
  { label: '4:5', w: 4, h: 5, group: 'Portrait' },
  { label: '3:4', w: 3, h: 4, group: 'Portrait' },
  { label: '2:3', w: 2, h: 3, group: 'Portrait' },
  { label: '9:16', w: 9, h: 16, group: 'Portrait' },
  { label: '1:2', w: 1, h: 2, group: 'Portrait' },
]

const ICON_SIZE = 20

function RatioIcon({ w, h }: { w: number; h: number }) {
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

function parseRatio(label: string): { w: number; h: number } {
  const [w, h] = label.split(':').map(Number)
  return { w: w || 1, h: h || 1 }
}

function orientationFromRatio(ratio: string): 'landscape' | 'portrait' {
  const { w, h } = parseRatio(ratio)
  return w >= h ? 'landscape' : 'portrait'
}

function buildRatioList(ratios?: {
  landscape?: Array<string>
  portrait?: Array<string>
}) {
  if (!ratios) return ALL_RATIOS
  const allowed = new Set([
    ...(ratios.landscape ?? []),
    ...(ratios.portrait ?? []),
  ])
  return ALL_RATIOS.filter((r) => allowed.has(r.label))
}

export function AspectRatioSelect({
  aspectRatio,
  onOrientationChange,
  onAspectRatioChange,
  ratios,
  disabled,
  className,
}: AspectRatioSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  const options = buildRatioList(ratios)
  const selected = options.find((o) => o.label === aspectRatio) ?? options[0]

  useEffect(() => {
    if (!isOpen) return
    const handleClick = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    const id = setTimeout(
      () => document.addEventListener('click', handleClick),
      0,
    )
    return () => {
      clearTimeout(id)
      document.removeEventListener('click', handleClick)
    }
  }, [isOpen])

  function handleSelect(label: string) {
    const nextOrientation = orientationFromRatio(label)
    onOrientationChange(nextOrientation)
    onAspectRatioChange(label)
    setIsOpen(false)
  }

  // Group options for rendering
  const groups: Array<{ name: string; items: typeof options }> = []
  let currentGroup = ''
  for (const opt of options) {
    if (opt.group !== currentGroup) {
      currentGroup = opt.group
      groups.push({ name: currentGroup, items: [] })
    }
    groups[groups.length - 1].items.push(opt)
  }

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        className={cn(
          'flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm',
          'hover:bg-accent hover:text-accent-foreground transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          disabled && 'pointer-events-none opacity-50',
        )}
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        aria-expanded={isOpen}
      >
        <RatioIcon w={selected.w} h={selected.h} />
        <span>{selected.label}</span>
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          className={cn(
            'absolute left-0 top-full z-50 mt-1 min-w-[160px] rounded-md border border-border bg-popover p-1 shadow-md',
            'animate-in fade-in-0 zoom-in-95',
          )}
        >
          {groups.map((group) => (
            <div key={group.name}>
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                {group.name}
              </div>
              {group.items.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm',
                    'hover:bg-accent hover:text-accent-foreground transition-colors',
                    opt.label === aspectRatio && 'bg-accent',
                  )}
                  onClick={() => handleSelect(opt.label)}
                >
                  <RatioIcon w={opt.w} h={opt.h} />
                  <span className="flex-1 text-left">{opt.label}</span>
                  {opt.label === aspectRatio && (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3.5 8.5L6.5 11.5L12.5 5" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
