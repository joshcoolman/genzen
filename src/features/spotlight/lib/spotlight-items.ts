import { BookOpen, Home } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { navItems } from '#/lib/nav-items'

export interface SpotlightItem {
  id: string
  label: string
  href: string
  icon: LucideIcon
  keywords?: Array<string>
}

const extraRoutes: Array<SpotlightItem> = [
  { id: '/', label: 'Home', href: '/', icon: Home },
  { id: '/docs', label: 'Docs', href: '/docs', icon: BookOpen },
]

export function getSpotlightItems(): Array<SpotlightItem> {
  const fromNav = navItems.map((item) => ({
    id: item.href,
    label: item.label,
    href: item.href,
    icon: item.icon,
  }))

  return [...extraRoutes, ...fromNav]
}
