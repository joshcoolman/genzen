import { Minus, Plus } from 'lucide-react'
import { cn } from '#/lib/utils'

interface NumberStepperProps {
  value: number
  min?: number
  max?: number
  onAdjust: (delta: number) => void
  disabled?: boolean
  className?: string
}

export function NumberStepper({
  value,
  min = 1,
  max = 99,
  onAdjust,
  disabled,
  className,
}: NumberStepperProps) {
  return (
    <div
      className={cn(
        'flex h-9 items-center gap-1 rounded-md border border-input bg-transparent px-2 shadow-xs',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      <button
        onClick={() => onAdjust(-1)}
        disabled={disabled || value <= min}
        className="size-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none"
      >
        <Minus className="size-3.5" />
      </button>
      <span className="text-sm font-medium w-4 text-center tabular-nums select-none">
        {value}
      </span>
      <button
        onClick={() => onAdjust(1)}
        disabled={disabled || value >= max}
        className="size-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none"
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  )
}
