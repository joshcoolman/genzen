import {
  Film,
  FlaskConical,
  FolderOpen,
  Settings,
  Sparkles,
  StickyNote,
  Trash2,
  User,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  id: string
  label: string
  href: string
  icon: LucideIcon
  activeOnly?: boolean
  dividerBefore?: boolean
  alwaysVisible?: boolean
}

export const navItems: Array<NavItem> = [
  {
    id: 'assets',
    label: 'Assets',
    href: '/dashboard/assets',
    icon: FolderOpen,
    alwaysVisible: true,
  },
  {
    id: 'ai-images',
    label: 'AI Images',
    href: '/dashboard/ai-images',
    icon: Sparkles,
    activeOnly: true,
  },
  {
    id: 'ai-video',
    label: 'AI Video',
    href: '/dashboard/video',
    icon: Film,
    activeOnly: true,
  },
  {
    id: 'notes',
    label: 'Notes',
    href: '/dashboard/notes',
    icon: StickyNote,
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
    id: 'dev-workspace',
    label: 'Dev Workspace',
    href: '/dashboard/dev-workspace',
    icon: FlaskConical,
    activeOnly: true,
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
    activeOnly: true,
    alwaysVisible: true,
  },
]
