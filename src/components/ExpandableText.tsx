import { useState } from 'react'
import { CopyButton } from './CopyButton'

interface ExpandableTextProps {
  text: string
  lines?: number
  copyable?: boolean
  className?: string
  textClassName?: string
}

export function ExpandableText({
  text,
  lines = 3,
  copyable = true,
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
      {copyable && (
        <CopyButton
          text={text}
          className="shrink-0 self-start text-muted-foreground/60 hover:text-foreground transition-colors"
        />
      )}
    </div>
  )
}
