'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
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
    <div className="border-t border-border px-3 py-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          disabled={disabled}
          className="flex w-full items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 py-1 pl-2 pr-1 text-[11px] text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          title="Browse agent skills"
        >
          <Sparkles className="h-3 w-3 shrink-0" />
          <span>Agent Skills</span>
          <span className="ml-auto rounded-full bg-muted/60 px-1.5 text-[10px] tabular-nums text-muted-foreground/80">
            {skills.length}
          </span>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="top"
          sideOffset={6}
          className="w-[calc(20rem-1.5rem)]"
        >
          <div className="max-h-[320px] overflow-y-auto p-1">
            {skills.map((skill) => (
              <button
                key={skill.name}
                type="button"
                onClick={() => {
                  setOpen(false)
                  onLaunch(skill.launch)
                }}
                className="flex w-full select-none flex-col items-start gap-0.5 rounded-sm px-2 py-2 text-left outline-hidden hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground"
              >
                <span className="text-sm font-medium">{skill.label}</span>
                <span className="line-clamp-2 text-[11px] text-muted-foreground">
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
