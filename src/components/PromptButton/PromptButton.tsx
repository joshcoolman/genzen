import { Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface PromptButtonProps {
  onPrompt: () => void
  loading?: boolean
  loadingText?: string
  label?: string
  disabled?: boolean
  className?: string
}

export function PromptButton({
  onPrompt,
  loading,
  loadingText,
  label,
  disabled,
  className,
}: PromptButtonProps) {
  const hasLabel = label || loadingText
  const icon = loading ? (
    <Loader2 className={cn('h-4 w-4 animate-spin', hasLabel && 'mr-1.5')} />
  ) : (
    <Sparkles className={cn('h-4 w-4', hasLabel && 'mr-1.5')} />
  )
  const text = loading && loadingText ? loadingText : label

  return (
    <Button
      variant="outline"
      size={hasLabel ? 'default' : 'icon'}
      className={cn('shrink-0', className)}
      onClick={onPrompt}
      disabled={disabled}
    >
      {icon}
      {text}
    </Button>
  )
}
