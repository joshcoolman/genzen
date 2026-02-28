import { cn } from '@/lib/utils'

interface MiniTabsProps<T extends string> {
  options: Array<T>
  value: T
  onChange: (value: T) => void
  disabled?: boolean
  className?: string
}

export function MiniTabs<T extends string>({
  options,
  value,
  onChange,
  disabled,
  className,
}: MiniTabsProps<T>) {
  return (
    <div className={cn('flex gap-1', className)}>
      {options.map((option) => (
        <button
          key={option}
          onClick={() => onChange(option)}
          disabled={disabled}
          className={cn(
            'px-2 py-1 text-[0.6rem] rounded transition-colors capitalize cursor-pointer',
            value === option
              ? 'bg-primary-dark text-primary-light'
              : 'text-muted-foreground hover:text-foreground',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          {option}
        </button>
      ))}
    </div>
  )
}
