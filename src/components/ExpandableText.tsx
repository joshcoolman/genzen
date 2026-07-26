'use client'

import { useState } from 'react'
import { CirclePlus } from 'lucide-react'
import { CopyButton } from './CopyButton'
import { ExpandableIconButton } from './ExpandableIconButton'

interface ExpandableTextProps {
  text: string
  lines?: number
  copyable?: boolean
  onAddPrompt?: (text: string) => void
  className?: string
  textClassName?: string
}

export function ExpandableText({
  text,
  lines = 3,
  copyable = true,
  onAddPrompt,
  className = 'px-4 pt-2 pb-1',
  textClassName = 'text-[11px] text-muted-foreground',
}: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={`flex gap-1.5 ${className}`}>
      <p
        className={`flex-1 cursor-pointer ${textClassName} ${expanded ? '' : `line-clamp-${lines}`}`}
        style={!expanded ? { WebkitLineClamp: lines } : undefined}
        onClick={(e) => {
          e.stopPropagation()
          setExpanded((v) => !v)
        }}
      >
        {text}
      </p>
      {(copyable || onAddPrompt) && (
        <div className="flex flex-col gap-1 shrink-0 self-start">
          {copyable && <CopyButton text={text} />}
          {onAddPrompt && (
            <ExpandableIconButton
              icon={<CirclePlus className="h-3.5 w-3.5" />}
              label="Add prompt to sidebar"
              onClick={() => onAddPrompt(text)}
            />
          )}
        </div>
      )}
    </div>
  )
}
