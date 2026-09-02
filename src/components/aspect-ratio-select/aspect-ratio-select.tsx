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
import { ALL_RATIOS } from './aspect-ratio-constants'
import { RatioIcon } from './ratio-icon'
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
