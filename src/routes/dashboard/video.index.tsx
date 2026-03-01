import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/lib/auth'
import { WorkspaceCard, useWorkspaces } from '@/features/ai-video'

export const Route = createFileRoute('/dashboard/video/')({
  component: VideoWorkspacesPage,
})

function VideoWorkspacesPage() {
  const { session } = useAuth()
  const navigate = useNavigate()

  const ws = useWorkspaces({
    accessToken: session?.access_token,
    navigate,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Video</h1>
        <Button onClick={ws.openDialog} size="sm">
          New Workspace
        </Button>
      </div>

      {ws.loading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : ws.workspaces.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center space-y-3">
          <p className="text-sm text-muted-foreground">No workspaces yet</p>
          <Button onClick={ws.openDialog} variant="outline" size="sm">
            New Workspace
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ws.workspaces.map((workspace) => (
            <WorkspaceCard
              key={workspace.id}
              workspace={workspace}
              onClick={() =>
                navigate({
                  to: '/dashboard/video/$workspaceId',
                  params: { workspaceId: workspace.id },
                  search: { generationId: undefined },
                })
              }
            />
          ))}
        </div>
      )}

      <Dialog open={ws.dialogOpen} onOpenChange={ws.setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Workspace</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Workspace name"
            value={ws.newName}
            onChange={(e) => ws.setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') ws.handleCreate()
            }}
            autoFocus
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={ws.closeDialog}
              disabled={ws.creating}
            >
              Cancel
            </Button>
            <Button
              onClick={ws.handleCreate}
              disabled={!ws.newName.trim() || ws.creating}
            >
              {ws.creating ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
