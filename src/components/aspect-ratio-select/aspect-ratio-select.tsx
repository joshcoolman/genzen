'use client'

import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import {
  autoUpdate,
  flip,
  offset,
  shift,
  useFloating,
} from '@floating-ui/react-dom'
import styles from './aspect-ratio-select.module.css'
import { cx } from '#/lib/utils'

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

  const { refs, floatingStyles } = useFloating({
    open: isOpen,
    placement: 'bottom-start',
    middleware: [offset(4), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  })

  const options = buildRatioList(ratios)
  const selected = options.find((o) => o.label === aspectRatio) ?? options[0]

  useEffect(() => {
    if (!isOpen) return
    const handleClick = (e: MouseEvent) => {
      const floating = refs.floating.current
      if (floating && !floating.contains(e.target as Node)) {
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
  }, [isOpen, refs.floating])

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
    <div className={cx(styles.root, className)}>
      <button
        type="button"
        ref={refs.setReference}
        className={cx(styles.trigger, disabled && styles.triggerDisabled)}
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        aria-expanded={isOpen}
      >
        <RatioIcon w={selected.w} h={selected.h} />
        <span>{selected.label}</span>
      </button>

      {isOpen && (
        <div
          ref={refs.setFloating}
          style={floatingStyles}
          className={styles.list}
        >
          {groups.map((group) => (
            <div key={group.name}>
              <div className={styles.groupLabel}>{group.name}</div>
              {group.items.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  className={cx(
                    styles.option,
                    opt.label === aspectRatio && styles.optionSelected,
                  )}
                  onClick={() => handleSelect(opt.label)}
                >
                  <RatioIcon w={opt.w} h={opt.h} />
                  <span className={styles.optionLabel}>{opt.label}</span>
                  {opt.label === aspectRatio && <Check size={16} />}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
