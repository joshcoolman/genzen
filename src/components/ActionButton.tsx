import * as React from 'react'
import { Slot } from 'radix-ui'
import { cn } from '@/lib/utils'

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean
  loadingText?: string
  asChild?: boolean
}

export function ActionButton({
  children,
  loading = false,
  loadingText,
  disabled,
  asChild = false,
  className,
  ...props
}: ActionButtonProps) {
  const Comp = asChild ? Slot.Root : 'button'

  return (
    <Comp
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-all',
        'bg-accent-gold text-black hover:bg-accent-gold-hover',
        'disabled:pointer-events-none disabled:opacity-50',
        "shrink-0 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        'outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        className,
      )}
      {...props}
    >
      {loading ? (loadingText ?? children) : children}
    </Comp>
  )
}
