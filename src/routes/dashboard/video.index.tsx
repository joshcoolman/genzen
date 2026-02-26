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

type Workspace = {
  id: string
  name: string
  createdAt: string
  generationCount: number
  preview: {
    heroUrl: string | null
    lastFrameUrl: string | null
    thumbnailUrls: Array<string>
    prompt: string | null
  }
}

function WorkspaceCard({
  workspace,
  onClick,
}: {
  workspace: Workspace
  onClick: () => void
}) {
  const hasHero = !!workspace.preview.heroUrl
  const hasThumbnails =
    workspace.generationCount >= 4 &&
    (workspace.preview.thumbnailUrls.length > 0 ||
      workspace.preview.lastFrameUrl)

  // Build thumbnail list: last_frame first, then other first_frames
  const thumbs: Array<string> = []
  if (workspace.preview.lastFrameUrl) {
    thumbs.push(workspace.preview.lastFrameUrl)
  }
  for (const url of workspace.preview.thumbnailUrls) {
    if (thumbs.length >= 4) break
    thumbs.push(url)
  }

  if (!hasHero) {
    return (
      <button
        onClick={onClick}
        className="rounded-lg border border-dashed border-border p-8 text-center space-y-2 hover:border-foreground/30 transition-colors"
      >
        <p className="text-sm font-medium">{workspace.name}</p>
        <p className="text-xs text-muted-foreground">No generations yet</p>
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      className="group relative aspect-[3/2] rounded-lg border border-border overflow-hidden hover:border-foreground/30 transition-colors text-left"
    >
      {/* Full-bleed hero image */}
      <img
        src={workspace.preview.heroUrl!}
        alt={workspace.name}
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Count badge */}
      <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white text-[10px] font-medium px-1.5 py-0.5 rounded z-10">
        {workspace.generationCount}
      </div>

      {/* Dark info strip at bottom */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-black/75 px-3 py-2.5 z-10">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white truncate">
            {workspace.name}
          </p>
          {workspace.preview.prompt && (
            <p className="text-[11px] text-white/50 line-clamp-1 mt-0.5">
              {workspace.preview.prompt}
            </p>
          )}
        </div>
        {hasThumbnails && thumbs.length > 0 && (
          <div className="flex gap-1 shrink-0">
            {thumbs.map((url, i) => (
              <img
                key={i}
                src={url}
                alt=""
                className="w-7 h-7 rounded object-cover border border-white/10"
              />
            ))}
          </div>
        )}
      </div>
    </button>
  )
}

function VideoWorkspacesPage() {
  const { session } = useAuth()
  const navigate = useNavigate()

  const [workspaces, setWorkspaces] = useState<Array<Workspace>>([])
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {workspaces.map((ws) => (
            <WorkspaceCard
              key={ws.id}
              workspace={ws}
              onClick={() =>
                navigate({
                  to: '/dashboard/video/$workspaceId',
                  params: { workspaceId: ws.id },
                })
              }
            />
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
