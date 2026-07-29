'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { ExpandableIconButton } from '../expandable-icon-button/expandable-icon-button'
import styles from './copy-button.module.css'

interface CopyButtonProps {
  text: string
}

export function CopyButton({ text }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  return (
    <ExpandableIconButton
      icon={
        copied ? (
          <Check className={`${styles.icon} ${styles.iconCopied}`} />
        ) : (
          <Copy className={styles.icon} />
        )
      }
      label="Copy"
      onClick={() => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
    />
  )
}
