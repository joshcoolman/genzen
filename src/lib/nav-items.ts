import {
  Clapperboard,
  Compass,
  FlaskConical,
  Logs,
  Sparkles,
  Trash2,
  User,
} from 'lucide-react'
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
  // Canvas, hidden from the rail on 2026-08-19 -- **commented out, not
  // deleted**. It is not being used, and the question is whether it is missed
  // once it stops being an obvious place to go. The route, its folder and its
  // CLAUDE.md are all untouched and `/canvas` still works if typed; this entry
  // is the only thing anywhere that links to it, so hiding it here hides it
  // everywhere. Uncomment to bring it back; delete this block and the route
  // folder if the answer turns out to be "not missed".
  // {
  //   id: 'canvas',
  //   label: 'Canvas',
  //   href: '/canvas',
  //   icon: Frame,
  // },
  {
    id: 'video',
    label: 'Video',
    href: '/video',
    icon: Clapperboard,
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
  // Below the divider with Trash: the places you go *about* the app rather
  // than to work in it.
  //
  // Shortcuts was a third entry here until #406 and is now /account/shortcuts,
  // a page inside the settings area. Note what that does to `isActive`, which
  // is a `startsWith`: every settings page begins with `/account`, so they all
  // light this one item -- which is correct, and is why nothing under /account
  // gets its own entry here. Adding one would light two rails at once.
  // Same rule as Account: one entry, and everything under it lights this one
  // item. The experiments are in the lab's own nav (#424).
  {
    id: 'lab',
    label: 'Lab',
    href: '/lab',
    icon: FlaskConical,
  },
  {
    id: 'account',
    label: 'Account',
    href: '/account',
    icon: User,
  },
]
