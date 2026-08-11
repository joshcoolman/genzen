'use client'

import { useState } from 'react'
import styles from './copy-text.module.css'
import { cx } from '#/lib/utils'

interface CopyTextProps {
  text: string
  /** Names the action in the hover hint and the accessible label. */
  label?: string
  /** Cmd/Ctrl-click does this instead of copying, and the hint says so. */
  onModifierClick?: (text: string) => void
  /** Names that second action. Required for it to be discoverable. */
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

  return (
    <button
      type="button"
      className={cx(styles.root, className)}
      onClick={(e) => {
        e.stopPropagation()
        if (onModifierClick && (e.metaKey || e.ctrlKey)) {
          onModifierClick(text)
          return
        }
        void copy()
      }}
      aria-label={copied ? 'Copied' : label}
    >
      <span className={cx(styles.text, textClassName)}>{text}</span>
      <span className={styles.hint}>
        {copied
          ? 'Copied'
          : onModifierClick && modifierLabel
            ? `${label}  ·  \u2318 ${modifierLabel}`
            : label}
      </span>
    </button>
  )
}
