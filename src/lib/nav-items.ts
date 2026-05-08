import {
  Camera,
  Clock,
  Film,
  FlaskConical,
  Frame,
  Logs,
  Settings,
  Sparkles,
  StickyNote,
  Tag,
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
    id: 'ai-video',
    label: 'AI Video',
    href: '/dashboard/video',
    icon: Film,
    activeOnly: true,
    matchPaths: ['/dashboard/multi-shot'],
  },
  {
    id: 'scenes',
    label: 'Scenes',
    href: '/dashboard/scenes',
    icon: Camera,
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
    id: 'canvas',
    label: 'Canvas',
    href: '/dashboard/canvas',
    icon: Frame,
    activeOnly: true,
  },
  {
    id: 'history',
    label: 'History',
    href: '/dashboard/history',
    icon: Clock,
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
    id: 'pricing',
    label: 'Model Pricing',
    href: '/dashboard/pricing',
    icon: Tag,
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
    alwaysVisible: true,
  },
]
