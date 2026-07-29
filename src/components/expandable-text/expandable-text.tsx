'use client'

import { useState } from 'react'
import { CirclePlus } from 'lucide-react'
import { CopyButton } from '../copy-button/copy-button'
import { ExpandableIconButton } from '../expandable-icon-button/expandable-icon-button'
import styles from './expandable-text.module.css'
import { cx } from '#/lib/utils'

interface ExpandableTextProps {
  text: string
  lines?: number
  copyable?: boolean
  onAddPrompt?: (text: string) => void
}

export function ExpandableText({
  text,
  lines = 3,
  copyable = true,
  onAddPrompt,
}: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={styles.root}>
      <p
        className={cx(styles.text, !expanded && styles.clamped)}
        style={!expanded ? { WebkitLineClamp: lines } : undefined}
        onClick={(e) => {
          e.stopPropagation()
          setExpanded((v) => !v)
        }}
      >
        {text}
      </p>
      {(copyable || onAddPrompt) && (
        <div className={styles.actions}>
          {copyable && <CopyButton text={text} />}
          {onAddPrompt && (
            <ExpandableIconButton
              icon={<CirclePlus className={styles.actionIcon} />}
              label="Add prompt to sidebar"
              onClick={() => onAddPrompt(text)}
            />
          )}
        </div>
      )}
    </div>
  )
}
