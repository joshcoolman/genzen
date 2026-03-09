import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RemoveButtonProps {
  onRemove: () => void
  size?: 'sm' | 'md'
  className?: string
}

export function RemoveButton({
  onRemove,
  size = 'md',
  className,
}: RemoveButtonProps) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className={cn(
        'absolute rounded-full bg-destructive text-destructive-foreground flex items-center justify-center',
        size === 'sm' ? '-top-1 -right-1 size-4' : '-top-1 -right-1 size-5',
        className,
      )}
    >
      <X className={size === 'sm' ? 'size-2.5' : 'size-3'} />
    </button>
  )
}
