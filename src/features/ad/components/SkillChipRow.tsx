import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { skills } from '../skills/registry'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'

interface SkillLauncherProps {
  onLaunch: (text: string) => void
  disabled?: boolean
}

// Show the search input once there are enough skills to make scrolling annoying.
const SEARCH_THRESHOLD = 6

export function SkillChipRow({ onLaunch, disabled }: SkillLauncherProps) {
  const [open, setOpen] = useState(false)
  if (skills.length === 0) return null

  const showSearch = skills.length >= SEARCH_THRESHOLD

  return (
    <div className="flex items-center border-t border-border px-3 py-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            disabled={disabled}
            className="flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 px-2.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
            title="Browse agent skills"
          >
            <Sparkles className="h-3 w-3" />
            Agent Skills
            <span className="ml-0.5 rounded-full bg-muted/60 px-1.5 text-[10px] tabular-nums text-muted-foreground/80">
              {skills.length}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="top"
          sideOffset={6}
          className="w-72 p-0"
        >
          <Command>
            {showSearch && (
              <CommandInput placeholder="Search skills…" className="h-9" />
            )}
            <CommandList className="max-h-[320px]">
              <CommandEmpty>No skills match.</CommandEmpty>
              <CommandGroup>
                {skills.map((skill) => (
                  <CommandItem
                    key={skill.name}
                    value={`${skill.label} ${skill.name} ${skill.description}`}
                    onSelect={() => {
                      setOpen(false)
                      onLaunch(skill.launch)
                    }}
                    className="flex flex-col items-start gap-0.5 py-2"
                  >
                    <span className="text-sm font-medium">{skill.label}</span>
                    <span className="line-clamp-2 text-[11px] text-muted-foreground">
                      {skill.description}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
