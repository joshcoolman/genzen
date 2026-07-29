'use client'

import { useState } from 'react'
import { BookOpen, ChevronDown, ChevronRight } from 'lucide-react'
import styles from './skill-loaded-card.module.css'
import { cx } from '#/lib/utils'

interface SkillLoadedCardProps {
  name: string
  body: string
}

export function SkillLoadedCard({ name, body }: SkillLoadedCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={styles.root}>
      <button onClick={() => setExpanded((v) => !v)} className={styles.toggle}>
        {expanded ? (
          <ChevronDown className={styles.toggleIcon} />
        ) : (
          <ChevronRight className={styles.toggleIcon} />
        )}
        <BookOpen className={styles.toggleIcon} />
        <span>
          Loaded skill: <span className={styles.name}>{name}</span>
        </span>
      </button>
      <div className={cx(styles.body, expanded && styles.bodyExpanded)}>
        <pre className={styles.text}>{body}</pre>
      </div>
    </div>
  )
}
