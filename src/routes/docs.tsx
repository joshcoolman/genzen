import { useEffect, useState } from 'react'
import { Outlet, createFileRoute, useLocation } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { DocsSidebar } from '@/features/docs/components/DocsSidebar'
import {
  getDocNavCategories,
  verifyDocsPassword,
} from '@/lib/docs/loadDocs.server'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/docs')({
  loader: async () => {
    const categories = await getDocNavCategories()
    return { categories }
  },
  component: DocsLayout,
})

function DocsLayout() {
  const { categories } = Route.useLoaderData()
  const [authed, setAuthed] = useState(false)
  const [checking, setChecking] = useState(true)
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const saved = localStorage.getItem('docs-password')
    if (saved) {
      verifyDocsPassword({ data: { password: saved } }).then((valid) => {
        if (valid) setAuthed(true)
        else localStorage.removeItem('docs-password')
        setChecking(false)
      })
    } else {
      setChecking(false)
    }
  }, [])

  // Close mobile menu when navigating to a new doc
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const valid = await verifyDocsPassword({ data: { password } })
    if (valid) {
      localStorage.setItem('docs-password', password)
      setAuthed(true)
      setError(false)
    } else {
      setError(true)
    }
  }

  if (checking) return null

  if (!authed) {
    return (
      <div className="flex h-[calc(100vh-49px)] items-center justify-center">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-72">
          <label className="text-sm text-muted-foreground">
            Enter password to view docs
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded border border-border bg-background px-3 py-2 text-sm"
            autoFocus
          />
          {error && (
            <p className="text-sm text-destructive">Incorrect password</p>
          )}
          <button
            type="submit"
            className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground"
          >
            Submit
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-49px)]">
      {/* Sidebar: always visible on md+, full-screen toggle on mobile */}
      <div
        className={cn(
          'md:block md:w-auto',
          mobileMenuOpen
            ? 'block w-full absolute inset-0 top-[49px] z-10 bg-background'
            : 'hidden',
        )}
      >
        <DocsSidebar categories={categories} />
      </div>
      {/* Content: always visible on md+, hidden when mobile menu is open */}
      <div
        className={cn(
          'flex-1 overflow-y-auto',
          mobileMenuOpen ? 'hidden md:block' : 'block',
        )}
      >
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="flex items-center gap-1.5 px-4 py-3 text-sm text-muted-foreground hover:text-foreground border-b border-border w-full md:hidden"
        >
          <ArrowLeft className="w-4 h-4" />
          Menu
        </button>
        <Outlet />
      </div>
    </div>
  )
}
