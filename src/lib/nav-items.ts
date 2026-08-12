import { Compass, Frame, Logs, Sparkles, Trash2, User } from 'lucide-react'
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
  // First, because it is where you arrive rather than where you work. Explore
  // is a browsing surface -- see `app/(authenticated)/explore/CLAUDE.md`.
  // Deleting that folder and this entry removes it completely; nothing else in
  // the app refers to it.
  {
    id: 'explore',
    label: 'Explore',
    href: '/explore',
    icon: Compass,
  },
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
    id: 'account',
    label: 'Account',
    href: '/account',
    icon: User,
  },
]
