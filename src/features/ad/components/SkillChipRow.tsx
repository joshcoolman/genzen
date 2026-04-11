import { Sparkles } from 'lucide-react'
import { skills } from '../skills/registry'

interface SkillChipRowProps {
  onLaunch: (text: string) => void
  disabled?: boolean
}

export function SkillChipRow({ onLaunch, disabled }: SkillChipRowProps) {
  if (skills.length === 0) return null

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto border-t border-border px-3 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <Sparkles className="h-3 w-3 shrink-0 text-muted-foreground/70" />
      {skills.map((skill) => (
        <button
          key={skill.name}
          onClick={() => onLaunch(skill.launch)}
          disabled={disabled}
          title={skill.description}
          className="shrink-0 rounded-full border border-border/60 bg-muted/30 px-2.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:pointer-events-none"
        >
          {skill.label}
        </button>
      ))}
    </div>
  )
}
