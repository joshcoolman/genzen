import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { ExpandableIconButton } from '@/components/ExpandableIconButton'

interface CopyButtonProps {
  text: string
}

export function CopyButton({ text }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  return (
    <ExpandableIconButton
      icon={
        copied ? (
          <Check className="h-3.5 w-3.5 text-green-500" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
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
