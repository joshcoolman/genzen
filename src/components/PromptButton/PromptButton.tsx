import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface PromptButtonProps {
  onPrompt: () => void
  loading?: boolean
  disabled?: boolean
  className?: string
}

export function PromptButton({
  onPrompt,
  loading,
  disabled,
  className,
}: PromptButtonProps) {
  return (
    <Button
      variant="outline"
      size="icon"
      className={cn('shrink-0', className)}
      onClick={onPrompt}
      disabled={disabled}
    >
      <Sparkles className={cn(loading && 'animate-pulse')} />
    </Button>
  )
}
