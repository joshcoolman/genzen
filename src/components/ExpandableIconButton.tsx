import { forwardRef } from 'react'
import type { ReactNode } from 'react'

interface ExpandableIconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode
  label: string
  variant?: 'default' | 'destructive'
}

export const ExpandableIconButton = forwardRef<
  HTMLButtonElement,
  ExpandableIconButtonProps
>(function ExpandableIconButton(
  { icon, label, variant = 'default', onClick, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.(e)
      }}
      className="group/eib flex items-center justify-center p-2.5 -m-1 cursor-pointer"
      {...rest}
    >
      <span
        className={`flex items-center justify-center rounded bg-background/80 backdrop-blur-sm p-1 text-muted-foreground transition-all duration-150 group-hover/eib:bg-sidebar-selected group-hover/eib:scale-[1.75] group-hover/eib:shadow-sm ${
          variant === 'destructive'
            ? 'group-hover/eib:text-destructive'
            : 'group-hover/eib:text-sidebar-selected-text'
        }`}
      >
        {icon}
      </span>
    </button>
  )
})
