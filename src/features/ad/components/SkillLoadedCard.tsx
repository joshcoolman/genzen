'use client'

import { useState } from 'react'
import { BookOpen, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SkillLoadedCardProps {
  name: string
  body: string
}

export function SkillLoadedCard({ name, body }: SkillLoadedCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="my-1 rounded-md border border-border/60 bg-muted/30 text-xs">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-muted-foreground transition-colors hover:text-foreground"
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0" />
        )}
        <BookOpen className="h-3 w-3 shrink-0" />
        <span>
          Loaded skill:{' '}
          <span className="font-mono text-foreground/80">{name}</span>
        </span>
      </button>
      <div
        className={cn(
          'overflow-hidden border-t border-border/40 transition-all',
          expanded ? 'max-h-[60vh] overflow-y-auto' : 'max-h-0 border-t-0',
        )}
      >
        <pre className="whitespace-pre-wrap p-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
          {body}
        </pre>
      </div>
    </div>
  )
}
