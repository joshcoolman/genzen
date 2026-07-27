import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '#/lib/utils'

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean
  loadingText?: string
  icon?: React.ReactNode
  variant?: 'default' | 'outline'
}

export function ActionButton({
  children,
  loading = false,
  loadingText,
  icon,
  variant = 'default',
  disabled,
  className,
  ...props
}: ActionButtonProps) {
  const isDisabled = disabled || loading

  return (
    <button
      disabled={isDisabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-all cursor-pointer',
        isDisabled
          ? 'bg-muted text-muted-foreground pointer-events-none'
          : variant === 'outline'
            ? 'border border-input bg-background text-muted-foreground shadow-xs hover:bg-accent hover:text-foreground'
            : 'bg-accent-brand text-black hover:bg-accent-brand-hover',
        "shrink-0 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        'outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        className,
      )}
      {...props}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : icon ? (
        icon
      ) : null}
      {loading ? (loadingText ?? children) : children}
    </button>
  )
}
