import {
  Boxes,
  Film,
  Image,
  LayoutGrid,
  PencilLine,
  ScanEye,
  Sparkles,
  Trash2,
  User,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  activeOnly?: boolean
  dividerBefore?: boolean
}

export const navItems: Array<NavItem> = [
  { label: 'Everything', href: '/dashboard', icon: LayoutGrid },
  {
    label: 'Uploads',
    href: '/dashboard/images',
    icon: Image,
    activeOnly: true,
  },
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
    label: 'Describe',
    href: '/dashboard/describe',
    icon: ScanEye,
    activeOnly: true,
  },
  {
    label: 'Edit Image',
    href: '/dashboard/edit-image',
    icon: PencilLine,
    activeOnly: true,
  },
  {
    label: 'Models',
    href: '/dashboard/models',
    icon: Boxes,
    activeOnly: true,
  },
  {
    label: 'Trash',
    href: '/dashboard/trash',
    icon: Trash2,
    activeOnly: true,
    dividerBefore: true,
  },
  {
    label: 'Account',
    href: '/dashboard/account',
    icon: User,
    activeOnly: true,
  },
]
