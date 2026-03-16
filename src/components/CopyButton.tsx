import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

interface CopyButtonProps {
  text: string
  className?: string
  iconSize?: string
}

export function CopyButton({
  text,
  className = 'text-muted-foreground/60 hover:text-foreground transition-colors',
  iconSize = 'h-3.5 w-3.5',
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      className={className}
      aria-label="Copy"
    >
      {copied ? (
        <Check className={`${iconSize} text-green-500`} />
      ) : (
        <Copy className={iconSize} />
      )}
    </button>
  )
}
