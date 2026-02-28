import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { LogOut } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useAccountStatus } from '@/lib/account-status'
import { useAuth } from '@/lib/auth'
import { useCredits } from '@/features/credits/hooks/use-credits'
import { navItems } from '@/lib/nav-items'
import { cn } from '@/lib/utils'

export function Sidebar({ className }: { className?: string }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { signOut, session } = useAuth()
  const accountStatus = useAccountStatus()
  const credits = useCredits(session?.access_token)

  const visibleItems = navItems.filter(
    (item) => !item.activeOnly || accountStatus === 'active',
  )

  const handleSignOut = async () => {
    await signOut()
    navigate({ to: '/' })
  }

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return location.pathname === '/dashboard'
    }
    return location.pathname.startsWith(href)
  }

  return (
    <aside
      className={cn(
        'fixed left-0 top-[52px] h-[calc(100vh-52px)] w-64 flex-col border-r border-border bg-sidebar',
        className,
      )}
    >
      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {visibleItems.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                active
                  ? 'border-l-2 border-accent-gold bg-sidebar-hover text-foreground'
                  : 'text-muted-foreground hover:bg-sidebar-hover hover:text-foreground',
              )}
            >
              <item.icon className="h-4 w-4" />
              <span className="flex-1">{item.label}</span>
              {item.label === 'Credits' && credits.balance !== null && (
                <span
                  className={cn(
                    'text-xs tabular-nums',
                    credits.isEmpty
                      ? 'text-red-500'
                      : credits.isLow
                        ? 'text-yellow-500'
                        : 'text-muted-foreground',
                  )}
                >
                  {credits.balance}
                </span>
              )}
            </Link>
          )
        })}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-hover hover:text-foreground transition-colors">
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Log out?</AlertDialogTitle>
              <AlertDialogDescription>
                You'll need to sign in again to access your account.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleSignOut}>
                Log out
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </nav>
    </aside>
  )
}
