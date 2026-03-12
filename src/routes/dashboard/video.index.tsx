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
import {
  FramePanel,
  GenerationRow,
  SelectionBar,
  VideoSettingsPanel,
  WorkspaceHeader,
  WorkspaceStrip,
  useActiveWorkspace,
  useVideoWorkspacePage,
} from '@/features/ai-video'
import { ConfirmDialog } from '@/components/confirm-dialog'

export const Route = createFileRoute('/dashboard/video/')({
  validateSearch: (search: Record<string, unknown>) => ({
    workspaceId:
      typeof search.workspaceId === 'string' ? search.workspaceId : undefined,
    generationId:
      typeof search.generationId === 'string' ? search.generationId : undefined,
  }),
  component: VideoPage,
})

function VideoPage() {
  const { session } = useAuth()
  const { workspaceId: searchWorkspaceId, generationId } = Route.useSearch()
  const navigate = useNavigate()

  const aws = useActiveWorkspace({
    accessToken: session?.access_token,
    initialWorkspaceId: searchWorkspaceId,
  })

  if (aws.loading || !aws.activeWorkspaceId) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <VideoCreationView
      workspaceId={aws.activeWorkspaceId}
      generationId={generationId}
      aws={aws}
      navigate={navigate}
    />
  )
}

function VideoCreationView({
  workspaceId,
  generationId,
  aws,
  navigate,
}: {
  workspaceId: string
  generationId: string | undefined
  aws: ReturnType<typeof useActiveWorkspace>
  navigate: ReturnType<typeof useNavigate>
}) {
  const page = useVideoWorkspacePage({
    workspaceId,
    generationId,
    navigate,
    onDeleted: aws.refresh,
  })

  const headerVariant = aws.workspaceCount <= 1 ? 'minimal' : 'full'

  const userImagesData = {
    images: page.userImages.images,
    imageUrls: page.userImages.imageUrls,
    isLoading: page.userImages.isLoading,
  }

  return (
    <div className="flex -m-6">
      <div className="flex-1 p-6 space-y-5 min-w-0">
        <WorkspaceHeader
          wsName={page.wsName}
          creditBalance={page.credits.balance}
          onDelete={page.wsDelete.startDelete}
          variant={headerVariant}
        />

        <ConfirmDialog
          open={page.wsDelete.deleteStep === 1}
          onOpenChange={(open) => {
            if (!open) page.wsDelete.closeDelete()
          }}
          title="Are you absolutely sure?"
          description="This will delete all generations in this workspace permanently. This cannot be undone."
          confirmLabel="Delete workspace"
          onConfirm={page.wsDelete.handleConfirmStep1}
        />

        <ConfirmDialog
          open={page.wsDelete.deleteStep === 2}
          onOpenChange={(open) => {
            if (!open) page.wsDelete.closeDelete()
          }}
          title={
            page.wsDelete.deleteMessage ?? 'Are you really sure about this?'
          }
          description={
            page.wsDelete.deleteMessage
              ? ''
              : 'Last chance. Every generation, every frame -- gone forever.'
          }
          confirmLabel="Yes, I'm really sure"
          onConfirm={page.wsDelete.handleConfirmStep2}
          loading={page.wsDelete.deleting}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FramePanel
            type="first"
            status={page.firstFrame.status}
            url={page.firstFrame.url}
            error={page.firstFrame.error}
            onFileSelected={page.firstFrameGen.setSourceFile}
            onImageFromUrl={page.firstFrameGen.setSourceFromUrl}
            userImages={userImagesData}
          />

          <FramePanel
            type="last"
            status={page.lastFrame.status}
            url={page.lastFrame.url}
            error={page.lastFrame.error}
            onFileSelected={page.lastFrameGen.setSourceFile}
            onImageFromUrl={page.lastFrameGen.setSourceFromUrl}
            userImages={userImagesData}
          />
        </div>

        {page.firstFrame.status !== 'idle' && (
          <div className="flex justify-end">
            <button
              onClick={page.resetAllState}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              + Start new generation
            </button>
          </div>
        )}

        {aws.workspaceCount >= 2 && (
          <WorkspaceStrip
            workspaces={aws.workspaces}
            activeWorkspaceId={aws.activeWorkspaceId}
            onSelect={aws.setActiveWorkspaceId}
            onCreateNew={() => aws.setDialogOpen(true)}
          />
        )}

        <div className="space-y-3">
          <h2 className="text-sm font-medium">Generations</h2>
          {page.gens.generations.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 flex items-center justify-center">
              <p className="text-xs text-muted-foreground">
                Generated videos will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {page.gens.generations.map((gen) => (
                <GenerationRow
                  key={gen.id}
                  generation={gen}
                  selected={page.selection.selectedIds.has(gen.id)}
                  onToggleSelect={page.selection.toggleSelect}
                  onLoad={page.handleLoadGeneration}
                  onContinue={page.handleContinueGeneration}
                  onUpdate={page.gens.updateGeneration}
                  onDelete={page.handleDeleteGeneration}
                  onGenerateVideo={page.videoGen.handleGenerateVideoFromRow}
                  onLastFrameCompleted={page.handleLastFrameCompleted}
                  accessToken={page.accessToken}
                />
              ))}
            </div>
          )}
        </div>

        <SelectionBar
          selectedCount={page.selection.selectedIds.size}
          isMoving={page.selection.isMoving}
          onNewWorkspace={page.selection.openCreateDialog}
          onMoveToWorkspace={page.selection.openMoveDialog}
          onCancel={page.selection.clearSelection}
          createDialogOpen={page.selection.createDialogOpen}
          onCreateDialogChange={page.selection.setCreateDialogOpen}
          newWorkspaceName={page.selection.newWorkspaceName}
          onNewWorkspaceNameChange={page.selection.setNewWorkspaceName}
          onCreateConfirm={page.selection.handleCreateAndMove}
          moveDialogOpen={page.selection.moveDialogOpen}
          onMoveDialogChange={page.selection.setMoveDialogOpen}
          targetWorkspaceId={page.selection.targetWorkspaceId}
          onTargetChange={page.selection.setTargetWorkspaceId}
          availableWorkspaces={page.selection.availableWorkspaces}
          onMoveConfirm={page.selection.handleMoveToWorkspace}
        />
      </div>

      <aside className="hidden md:block w-72 shrink-0 border-l border-border bg-sidebar sticky top-0 h-screen overflow-y-auto p-4">
        <VideoSettingsPanel
          settings={page.videoGen.videoSettings}
          onChange={page.videoGen.setVideoSettings}
          onGenerate={page.videoGen.handleGenerateVideo}
          disabled={
            page.firstFrame.status !== 'completed' || !page.firstFrame.recordId
          }
          generating={page.videoGen.generatingVideo}
          firstFrameReady={page.firstFrame.status === 'completed'}
        />
      </aside>

      <Dialog open={aws.dialogOpen} onOpenChange={aws.setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Workspace</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Workspace name"
            value={aws.newName}
            onChange={(e) => aws.setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') aws.handleCreate()
            }}
            autoFocus
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => aws.setDialogOpen(false)}
              disabled={aws.creating}
            >
              Cancel
            </Button>
            <Button
              onClick={aws.handleCreate}
              disabled={!aws.newName.trim() || aws.creating}
            >
              {aws.creating ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
