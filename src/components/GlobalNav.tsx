import { Link, useLocation } from '@tanstack/react-router'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'

export function GlobalNav() {
  const { user, loading } = useAuth()
  const location = useLocation()

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return location.pathname.startsWith('/dashboard')
    }
    return location.pathname === href
  }

  const linkClass = (href: string) =>
    cn(
      'text-sm transition-colors',
      isActive(href)
        ? 'text-foreground font-medium'
        : 'text-muted-foreground hover:text-foreground',
    )

  return (
    <nav className="flex items-center justify-between px-6 py-3 bg-background">
      <Link
        to="/"
        className="text-lg font-semibold text-foreground hover:text-accent-brand transition-colors"
      >
        genzen
      </Link>
      <div className="flex items-center gap-4">
        <Link to="/about" className={linkClass('/about')}>
          About
        </Link>
        {!loading &&
          (user ? (
            <Link to="/dashboard" className={linkClass('/dashboard')}>
              Dashboard
            </Link>
          ) : (
            <Link to="/login" className={linkClass('/login')}>
              Login
            </Link>
          ))}
      </div>
    </nav>
  )
}
