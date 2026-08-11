'use client'

import { useEffect, useState } from 'react'
import styles from './copy-text.module.css'
import { cx } from '#/lib/utils'

interface CopyTextProps {
  text: string
  /** Names the action in the hover hint and the accessible label. */
  label?: string
  /** Cmd/Ctrl-click does this instead of copying. */
  onModifierClick?: (text: string) => void
  /** Names that second action. The hint switches to it while the modifier is
   *  actually held, so the shortcut announces itself to someone reaching for
   *  it and stays out of the way of everyone else. */
  modifierLabel?: string
  /** On the button: spacing that belongs to the layout, not the affordance. */
  className?: string
  /** On the text itself: size, colour, clamping. */
  textClassName?: string
}

/**
 * Text that is its own copy button (#282). Hovering tints it and names the
 * action; clicking copies. There is no icon -- one in a rail beside the text
 * was one more thing to aim at and one more thing to look at.
 *
 * The tick clears itself after a moment, but a caller that swaps the text
 * under a mounted instance should `key` it: a tick left standing reads as a
 * claim about whatever is on screen now.
 */
export function CopyText({
  text,
  label = 'Copy',
  onModifierClick,
  modifierLabel,
  className,
  textClassName,
}: CopyTextProps) {
  const [copied, setCopied] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [modifierHeld, setModifierHeld] = useState(false)

  // Only while this one is hovered. A grid renders dozens of these, and a
  // permanent key listener per card to answer a question nobody is asking is
  // the kind of thing that is invisible until the grid is long.
  const watching = hovered && !!onModifierClick && !!modifierLabel

  useEffect(() => {
    if (!watching) {
      setModifierHeld(false)
      return
    }
    const sync = (e: KeyboardEvent) => setModifierHeld(e.metaKey || e.ctrlKey)
    // Releasing the key outside the window never reaches keyup, which would
    // leave the label lying about what the next click does.
    const clear = () => setModifierHeld(false)
    window.addEventListener('keydown', sync)
    window.addEventListener('keyup', sync)
    window.addEventListener('blur', clear)
    return () => {
      window.removeEventListener('keydown', sync)
      window.removeEventListener('keyup', sync)
      window.removeEventListener('blur', clear)
    }
  }, [watching])

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard access can be refused (permission, an unfocused document).
      // Staying silent is right -- the tick is the only claim this makes, and
      // not showing it is an honest one.
    }
  }

  const hint = copied
    ? 'Copied'
    : watching && modifierHeld
      ? modifierLabel
      : label

  return (
    <button
      type="button"
      className={cx(styles.root, className)}
      // The key may already be down before the pointer arrives, and that
      // keydown is long gone -- so the entering event answers it too.
      onMouseEnter={(e) => {
        setHovered(true)
        setModifierHeld(e.metaKey || e.ctrlKey)
      }}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      onClick={(e) => {
        e.stopPropagation()
        if (onModifierClick && (e.metaKey || e.ctrlKey)) {
          onModifierClick(text)
          return
        }
        void copy()
      }}
      aria-label={hint}
    >
      <span className={cx(styles.text, textClassName)}>{text}</span>
      <span className={styles.hint}>{hint}</span>
    </button>
  )
}
