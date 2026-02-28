import {
  Activity,
  Coins,
  Film,
  Home,
  Image,
  LayoutGrid,
  Settings,
  Sparkles,
  User,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  activeOnly?: boolean
}

export const navItems: Array<NavItem> = [
  { label: 'Home', href: '/dashboard', icon: Home },
  {
    label: 'Status',
    href: '/dashboard/status',
    icon: Activity,
    activeOnly: true,
  },
  { label: 'Images', href: '/dashboard/images', icon: Image, activeOnly: true },
  {
    label: 'AI Images',
    href: '/dashboard/ai-images',
    icon: Sparkles,
    activeOnly: true,
  },
  {
    label: 'AI Video',
    href: '/dashboard/video',
    icon: Film,
    activeOnly: true,
  },
  {
    label: 'Everything',
    href: '/dashboard/everything',
    icon: LayoutGrid,
    activeOnly: true,
  },
  {
    label: 'Credits',
    href: '/dashboard/credits',
    icon: Coins,
    activeOnly: true,
  },
  { label: 'Profile', href: '/dashboard/profile', icon: User },
  {
    label: 'Settings',
    href: '/dashboard/settings',
    icon: Settings,
    activeOnly: true,
  },
]
