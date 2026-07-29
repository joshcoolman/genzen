'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import styles from './skill-chip-row.module.css'
import { skills } from '#/features/ad/skills/registry'
import { Popover, PopoverContent, PopoverTrigger } from '#/components'

interface SkillLauncherProps {
  onLaunch: (text: string) => void
  disabled?: boolean
}

export function SkillChipRow({ onLaunch, disabled }: SkillLauncherProps) {
  const [open, setOpen] = useState(false)
  if (skills.length === 0) return null

  return (
    <div className={styles.root}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          disabled={disabled}
          className={styles.trigger}
          title="Browse agent skills"
        >
          <Sparkles className={styles.triggerIcon} />
          <span>Agent Skills</span>
          <span className={styles.count}>{skills.length}</span>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="top"
          sideOffset={6}
          className={styles.popover}
        >
          <div className={styles.list}>
            {skills.map((skill) => (
              <button
                key={skill.name}
                type="button"
                onClick={() => {
                  setOpen(false)
                  onLaunch(skill.launch)
                }}
                className={styles.item}
              >
                <span className={styles.itemLabel}>{skill.label}</span>
                <span className={styles.itemDescription}>
                  {skill.description}
                </span>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
