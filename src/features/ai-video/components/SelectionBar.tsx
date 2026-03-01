import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface SelectionBarProps {
  selectedCount: number
  isMoving: boolean
  onNewWorkspace: () => void
  onMoveToWorkspace: () => void
  onCancel: () => void
  // Create dialog
  createDialogOpen: boolean
  onCreateDialogChange: (open: boolean) => void
  newWorkspaceName: string
  onNewWorkspaceNameChange: (name: string) => void
  onCreateConfirm: () => void
  // Move dialog
  moveDialogOpen: boolean
  onMoveDialogChange: (open: boolean) => void
  targetWorkspaceId: string | null
  onTargetChange: (id: string) => void
  availableWorkspaces: Array<{
    id: string
    name: string
    generationCount: number
    preview: { heroUrl: string | null }
  }>
  onMoveConfirm: () => void
}

export function SelectionBar({
  selectedCount,
  isMoving,
  onNewWorkspace,
  onMoveToWorkspace,
  onCancel,
  createDialogOpen,
  onCreateDialogChange,
  newWorkspaceName,
  onNewWorkspaceNameChange,
  onCreateConfirm,
  moveDialogOpen,
  onMoveDialogChange,
  targetWorkspaceId,
  onTargetChange,
  availableWorkspaces,
  onMoveConfirm,
}: SelectionBarProps) {
  return (
    <>
      {/* Floating selection bar */}
      <div
        className={cn(
          'fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg border border-border bg-background/95 backdrop-blur-sm px-5 py-3 shadow-lg transition-all duration-200',
          selectedCount > 0
            ? 'translate-y-0 opacity-100'
            : 'translate-y-4 opacity-0 pointer-events-none',
        )}
      >
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {selectedCount} selected
        </span>
        <Button
          size="sm"
          disabled={isMoving || selectedCount === 0}
          onClick={onNewWorkspace}
        >
          New workspace
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={isMoving || selectedCount === 0}
          onClick={onMoveToWorkspace}
        >
          Move to workspace
        </Button>
        <button
          onClick={onCancel}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>

      {/* Create new workspace dialog */}
      <Dialog open={createDialogOpen} onOpenChange={onCreateDialogChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New workspace</DialogTitle>
          </DialogHeader>
          <input
            type="text"
            value={newWorkspaceName}
            onChange={(e) => onNewWorkspaceNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newWorkspaceName.trim()) {
                ;(
                  e.currentTarget
                    .closest('[role="dialog"]')
                    ?.querySelector(
                      '[data-create-confirm]',
                    ) as HTMLButtonElement | null
                )?.click()
              }
            }}
            placeholder="Workspace name"
            autoFocus
            className="h-9 px-3 text-sm rounded border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent-brand w-full"
          />
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onCreateDialogChange(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              data-create-confirm
              disabled={!newWorkspaceName.trim() || isMoving}
              onClick={onCreateConfirm}
            >
              {isMoving ? 'Creating...' : 'Done'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move to workspace dialog */}
      <Dialog open={moveDialogOpen} onOpenChange={onMoveDialogChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Move to workspace</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 max-h-80 overflow-y-auto py-2">
            {availableWorkspaces.length === 0 ? (
              <p className="col-span-2 text-sm text-muted-foreground text-center py-6">
                No other workspaces found
              </p>
            ) : (
              availableWorkspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => onTargetChange(ws.id)}
                  className={cn(
                    'rounded-lg border p-2 text-left transition-colors',
                    targetWorkspaceId === ws.id
                      ? 'border-accent-brand bg-accent-brand/5'
                      : 'border-border hover:bg-muted/30',
                  )}
                >
                  {ws.preview.heroUrl ? (
                    <img
                      src={ws.preview.heroUrl}
                      alt={ws.name}
                      className="aspect-video w-full rounded object-cover mb-2"
                    />
                  ) : (
                    <div className="aspect-video w-full rounded bg-muted/30 mb-2" />
                  )}
                  <p className="text-sm font-medium truncate">{ws.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {ws.generationCount} generation
                    {ws.generationCount !== 1 ? 's' : ''}
                  </p>
                </button>
              ))
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onMoveDialogChange(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!targetWorkspaceId || isMoving}
              onClick={onMoveConfirm}
            >
              {isMoving ? 'Moving...' : 'Done'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
