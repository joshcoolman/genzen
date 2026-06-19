import { Frame, Logs, Settings, Sparkles, Trash2, User } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  id: string
  label: string
  href: string
  icon: LucideIcon
  activeOnly?: boolean
  dividerBefore?: boolean
  alwaysVisible?: boolean
  matchPaths?: Array<string>
}

export const navItems: Array<NavItem> = [
  {
    id: 'ai-images',
    label: 'AI Images',
    href: '/dashboard/ai-images',
    icon: Sparkles,
    activeOnly: true,
  },
  {
    id: 'canvas',
    label: 'Canvas',
    href: '/dashboard/canvas',
    icon: Frame,
    activeOnly: true,
  },
  {
    id: 'activity',
    label: 'Activity',
    href: '/dashboard/activity',
    icon: Logs,
    activeOnly: true,
  },
  {
    id: 'trash',
    label: 'Trash',
    href: '/dashboard/trash',
    icon: Trash2,
    activeOnly: true,
    dividerBefore: true,
  },
  {
    id: 'settings',
    label: 'Settings',
    href: '/dashboard/settings',
    icon: Settings,
    alwaysVisible: true,
  },
  {
    id: 'account',
    label: 'Account',
    href: '/dashboard/account',
    icon: User,
    alwaysVisible: true,
  },
]
