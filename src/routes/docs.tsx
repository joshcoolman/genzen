import { useEffect, useState } from 'react'
import { Outlet, createFileRoute } from '@tanstack/react-router'
import { DocsSidebar } from '@/features/docs/components/DocsSidebar'
import {
  getDocNavCategories,
  verifyDocsPassword,
} from '@/lib/docs/loadDocs.server'

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
      <DocsSidebar categories={categories} />
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  )
}
