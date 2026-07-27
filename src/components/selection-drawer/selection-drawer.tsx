import { Button } from '../ui/button/button'
import type { ReactNode } from 'react'
import { cn } from '#/lib/utils'

interface SelectionDrawerProps {
  count: number
  onClear: () => void
  children: ReactNode
}

export function SelectionDrawer({
  count,
  onClear,
  children,
}: SelectionDrawerProps) {
  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-50 flex justify-center p-4 transition-all duration-200',
        count > 0
          ? 'translate-y-0 opacity-100'
          : 'pointer-events-none translate-y-4 opacity-0',
      )}
    >
      <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-background/95 px-5 py-3 shadow-lg backdrop-blur-sm">
        <span className="text-sm font-medium text-muted-foreground">
          {count} selected
        </span>
        <div className="flex items-center gap-2">{children}</div>
        <Button variant="ghost" size="sm" onClick={onClear}>
          Deselect all
        </Button>
      </div>
    </div>
  )
}
