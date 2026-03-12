import { Link } from '@tanstack/react-router'
import { ChevronRight, SquareLibrary } from 'lucide-react'
import type { NavItem } from '@/lib/nav-items'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

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
  if (hiddenItems.length === 0) return null

  const button = (
    <PopoverTrigger asChild>
      <button
        className={cn(
          'flex w-full items-center rounded-md px-3 py-2 text-sm transition-colors gap-3',
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
            <ChevronRight className="h-3 w-3 opacity-50" />
          </>
        )}
        {variant === 'sidebar' && !isCollapsed && (
          <>
            <span className="hidden flex-1 text-left md:block">More</span>
            <ChevronRight className="hidden h-3 w-3 translate-y-px opacity-50 md:inline" />
          </>
        )}
      </button>
    </PopoverTrigger>
  )

  return (
    <Popover>
      {variant === 'sidebar' ? (
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent
            side="right"
            className={cn('text-xs', !isCollapsed && 'md:hidden')}
            sideOffset={8}
          >
            More
          </TooltipContent>
        </Tooltip>
      ) : (
        button
      )}
      <PopoverContent
        side={variant === 'sidebar' ? 'right' : 'bottom'}
        align="start"
        className="w-48 p-2"
        sideOffset={8}
      >
        <div className="space-y-0.5">
          {hiddenItems.map((item) => (
            <Link
              key={item.id}
              to={item.href}
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
