'use client'

import { useCallback, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, SquareLibrary } from 'lucide-react'
import type { NavItem } from '#/lib/nav-items'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components'
import { cn } from '#/lib/utils'

interface NavMoreProps {
  isCollapsed?: boolean
  variant?: 'sidebar' | 'mobile'
  hiddenItems: Array<NavItem>
}

export function NavMore({
  isCollapsed = false,
  variant = 'sidebar',
  hiddenItems,
}: NavMoreProps) {
  const [open, setOpen] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(null)

  const handleEnter = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setOpen(true)
  }, [])

  const handleLeave = useCallback(() => {
    closeTimer.current = setTimeout(() => setOpen(false), 150)
  }, [])

  if (hiddenItems.length === 0) return null

  const trigger = (
    <PopoverTrigger asChild>
      <div
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        className={cn(
          'flex w-full cursor-pointer items-center rounded-md px-3 py-2 text-sm transition-colors gap-3',
          variant === 'sidebar'
            ? 'text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-hover-text'
            : 'text-muted-foreground hover:bg-sidebar-hover hover:text-foreground',
          isCollapsed ? 'justify-center' : 'justify-center md:justify-start',
        )}
      >
        <SquareLibrary className="h-4 w-4 shrink-0" />
        {variant === 'mobile' && (
          <>
            <span className="flex-1">More</span>
            <ChevronRight className="h-3 w-3 translate-y-px opacity-50" />
          </>
        )}
        {variant === 'sidebar' && !isCollapsed && (
          <>
            <span className="hidden flex-1 text-left md:block">More</span>
            <ChevronRight className="hidden h-3 w-3 translate-y-px opacity-50 md:inline" />
          </>
        )}
      </div>
    </PopoverTrigger>
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {variant === 'sidebar' ? (
        <Tooltip>
          <TooltipTrigger asChild>{trigger}</TooltipTrigger>
          <TooltipContent
            side="right"
            className={cn('text-xs', !isCollapsed && 'md:hidden')}
            sideOffset={8}
          >
            More
          </TooltipContent>
        </Tooltip>
      ) : (
        trigger
      )}
      <PopoverContent
        side={variant === 'sidebar' ? 'right' : 'bottom'}
        align="start"
        className="w-48 p-2"
        sideOffset={8}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="space-y-0.5">
          {hiddenItems.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <item.icon className="h-3.5 w-3.5" />
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
