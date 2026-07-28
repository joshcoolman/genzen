import { Frame, Logs, Settings, Sparkles, Trash2, User } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  id: string
  label: string
  href: string
  icon: LucideIcon
  dividerBefore?: boolean
  matchPaths?: Array<string>
}

export const navItems: Array<NavItem> = [
  {
    id: 'images',
    label: 'Images',
    href: '/images',
    icon: Sparkles,
  },
  {
    id: 'canvas',
    label: 'Canvas',
    href: '/canvas',
    icon: Frame,
  },
  {
    id: 'activity',
    label: 'Activity',
    href: '/activity',
    icon: Logs,
  },
  {
    id: 'trash',
    label: 'Trash',
    href: '/trash',
    icon: Trash2,
    dividerBefore: true,
  },
  {
    id: 'settings',
    label: 'Settings',
    href: '/settings',
    icon: Settings,
  },
  {
    id: 'account',
    label: 'Account',
    href: '/account',
    icon: User,
  },
]
