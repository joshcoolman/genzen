import { Settings } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
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
import { navItems } from '@/lib/nav-items'
import { useNavVisibility } from '@/lib/use-nav-visibility'
import { cn } from '@/lib/utils'

interface NavSettingsProps {
  isCollapsed?: boolean
  variant?: 'sidebar' | 'mobile'
}

export function NavSettings({
  isCollapsed = false,
  variant = 'sidebar',
}: NavSettingsProps) {
  const { toggleItem, isItemHidden, showMoreNav, toggleShowMore } =
    useNavVisibility()

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
        <Settings className="h-4 w-4 shrink-0" />
        {variant === 'mobile' && <span>Settings</span>}
        {variant === 'sidebar' && !isCollapsed && (
          <span className="hidden md:inline">Settings</span>
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
            Settings
          </TooltipContent>
        </Tooltip>
      ) : (
        button
      )}
      <PopoverContent
        side={variant === 'sidebar' ? 'right' : 'bottom'}
        align="end"
        className="w-56 p-3"
        sideOffset={8}
      >
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          Show in sidebar
        </p>
        <div className="space-y-1">
          {navItems.map((item) => {
            const isAlwaysVisible = item.alwaysVisible === true
            const isHidden = isItemHidden(item.id)
            return (
              <label
                key={item.id}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-muted',
                  isAlwaysVisible && 'opacity-50 cursor-default',
                )}
              >
                <Checkbox
                  checked={isAlwaysVisible || !isHidden}
                  onCheckedChange={() => {
                    if (!isAlwaysVisible) toggleItem(item.id)
                  }}
                  disabled={isAlwaysVisible}
                  className="h-3.5 w-3.5"
                />
                <item.icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </label>
            )
          })}
        </div>
        <div className="my-2 border-t border-border" />
        <label className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-muted">
          <Checkbox
            checked={showMoreNav}
            onCheckedChange={() => toggleShowMore()}
            className="h-3.5 w-3.5"
          />
          <span>Show More menu</span>
        </label>
      </PopoverContent>
    </Popover>
  )
}
