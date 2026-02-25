import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { getWorkspaces } from '@/features/ai-video/server/get-workspaces.server'
import { createWorkspace } from '@/features/ai-video/server/create-workspace.server'
import { useAuth } from '@/lib/auth'

export const Route = createFileRoute('/dashboard/video/')({
  component: VideoWorkspacesPage,
})

function VideoWorkspacesPage() {
  const { session } = useAuth()
  const navigate = useNavigate()

  const [workspaces, setWorkspaces] = useState<
    Array<{
      id: string
      name: string
      createdAt: string
      generationCount: number
    }>
  >([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!session?.access_token) return
    getWorkspaces({ data: { accessToken: session.access_token } })
      .then(setWorkspaces)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [session?.access_token])

  async function handleCreate() {
    if (!session?.access_token || !newName.trim()) return
    setCreating(true)
    try {
      const workspace = await createWorkspace({
        data: { name: newName.trim(), accessToken: session.access_token },
      })
      setDialogOpen(false)
      setNewName('')
      await navigate({
        to: '/dashboard/video/$workspaceId',
        params: { workspaceId: workspace.id },
      })
    } catch {
      // keep dialog open on error
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Video</h1>
        <Button onClick={() => setDialogOpen(true)} size="sm">
          New Workspace
        </Button>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : workspaces.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center space-y-3">
          <p className="text-sm text-muted-foreground">No workspaces yet</p>
          <Button
            onClick={() => setDialogOpen(true)}
            variant="outline"
            size="sm"
          >
            New Workspace
          </Button>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              onClick={() =>
                navigate({
                  to: '/dashboard/video/$workspaceId',
                  params: { workspaceId: ws.id },
                })
              }
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/40 transition-colors"
            >
              <span className="text-sm font-medium">{ws.name}</span>
              <span className="text-xs text-muted-foreground">
                {ws.generationCount}{' '}
                {ws.generationCount === 1 ? 'generation' : 'generations'}{' '}
                &middot; {new Date(ws.createdAt).toLocaleDateString()}
              </span>
            </button>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Workspace</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Workspace name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate()
            }}
            autoFocus
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false)
                setNewName('')
              }}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!newName.trim() || creating}
            >
              {creating ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
