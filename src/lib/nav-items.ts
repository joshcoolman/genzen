import {
  Boxes,
  Expand,
  Film,
  FlaskConical,
  Grid3X3,
  Image,
  Layers,
  LayoutGrid,
  Lightbulb,
  MessageSquare,
  Palette,
  PencilLine,
  Sparkles,
  SquarePlay,
  StickyNote,
  Trash2,
  User,
  Users,
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
    id: 'everything',
    label: 'Everything',
    href: '/dashboard',
    icon: LayoutGrid,
    alwaysVisible: true,
  },
  {
    id: 'uploads',
    label: 'Uploads',
    href: '/dashboard/images',
    icon: Image,
    activeOnly: true,
  },
  {
    id: 'ai-images',
    label: 'AI Images',
    href: '/dashboard/ai-images',
    icon: Sparkles,
    activeOnly: true,
  },
  {
    id: 'brainstorm',
    label: 'Brainstorm',
    href: '/dashboard/brainstorm',
    icon: Lightbulb,
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
    id: 'edit-image',
    label: 'Edit Image',
    href: '/dashboard/edit-image',
    icon: PencilLine,
    activeOnly: true,
  },
  {
    id: 'outpaint',
    label: 'Outpaint',
    href: '/dashboard/outpaint',
    icon: Expand,
    activeOnly: true,
  },
  {
    id: 'combine',
    label: 'Combine',
    href: '/dashboard/combine',
    icon: Layers,
    activeOnly: true,
  },
  {
    id: 'shots',
    label: 'Shots',
    href: '/dashboard/shots',
    icon: Grid3X3,
    activeOnly: true,
  },
  {
    id: 'characters',
    label: 'Characters',
    href: '/dashboard/characters',
    icon: Users,
    activeOnly: true,
  },
  {
    id: 'storyboard',
    label: 'Storyboard',
    href: '/dashboard/storyboard',
    icon: SquarePlay,
    activeOnly: true,
  },
  {
    id: 'style-trainer',
    label: 'Style Trainer',
    href: '/dashboard/style-trainer',
    icon: Palette,
    activeOnly: true,
  },
  {
    id: 'prompt-studio',
    label: 'Prompt Studio',
    href: '/dashboard/prompt-studio',
    icon: MessageSquare,
    activeOnly: true,
  },
  {
    id: 'models',
    label: 'Models',
    href: '/dashboard/models',
    icon: Boxes,
    activeOnly: true,
  },
  {
    id: 'dev-workspace',
    label: 'Dev Workspace',
    href: '/dashboard/dev-workspace',
    icon: FlaskConical,
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
    id: 'account',
    label: 'Account',
    href: '/dashboard/account',
    icon: User,
    activeOnly: true,
    alwaysVisible: true,
  },
]
