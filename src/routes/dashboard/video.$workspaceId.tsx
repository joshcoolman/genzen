import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  FramePanel,
  GenerationRow,
  SelectionBar,
  VideoSettingsPanel,
  WorkspaceHeader,
  useVideoWorkspacePage,
} from '@/features/ai-video'
import { ConfirmDialog } from '@/components/confirm-dialog'

export const Route = createFileRoute('/dashboard/video/$workspaceId')({
  validateSearch: (search: Record<string, unknown>) => ({
    generationId:
      typeof search.generationId === 'string' ? search.generationId : undefined,
  }),
  component: WorkspaceDetailPage,
})

function WorkspaceDetailPage() {
  const { workspaceId } = Route.useParams()
  const { generationId } = Route.useSearch()
  const navigate = useNavigate()

  const page = useVideoWorkspacePage({ workspaceId, generationId, navigate })

  return (
    <div className="flex -m-6">
      <div className="flex-1 p-6 space-y-5 min-w-0">
        <WorkspaceHeader
          wsName={page.wsName}
          creditBalance={page.credits.balance}
          onDelete={page.wsDelete.startDelete}
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

        <input
          ref={page.firstFrameGen.firstFrameFileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={page.firstFrameGen.handleFilePick}
        />
        <input
          ref={page.lastFrameGen.lastFrameFileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={page.lastFrameGen.handleFilePick}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FramePanel
            type="first"
            mode={page.firstFrameMode}
            onModeChange={page.firstFrameGen.handleModeChange}
            status={page.firstFrame.status}
            url={page.firstFrame.url}
            error={page.firstFrame.error}
            prompt={page.firstFrameGen.firstFramePrompt}
            onPromptChange={page.firstFrameGen.setFirstFramePrompt}
            suggesting={page.firstFrameGen.suggestingFirstFrame}
            onSuggest={page.firstFrameGen.handleSuggest}
            onChooseImage={() =>
              page.firstFrameGen.firstFrameFileInputRef.current?.click()
            }
            onGenerate={page.firstFrameGen.handleGenerate}
          />

          <FramePanel
            type="last"
            mode={page.lastFrameGen.lastFrameMode}
            onModeChange={page.lastFrameGen.handleModeChange}
            status={page.lastFrame.status}
            url={page.lastFrame.url}
            error={page.lastFrame.error}
            locked={page.lastFrameGen.lastFrameLocked}
            prompt={page.lastFrameGen.lastFramePrompt}
            onPromptChange={page.lastFrameGen.setLastFramePrompt}
            suggesting={page.lastFrameGen.suggestingLastFrame}
            onSuggest={page.lastFrameGen.handleSuggest}
            onChooseImage={() =>
              page.lastFrameGen.lastFrameFileInputRef.current?.click()
            }
            onGenerate={page.lastFrameGen.handleGenerate}
            generateDisabled={page.lastFrameGen.generateDisabled}
            includeFirstFrame={page.lastFrameGen.includeFirstFrame}
            onIncludeFirstFrameChange={page.lastFrameGen.setIncludeFirstFrame}
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

      {page.showSidebar && (
        <aside className="hidden md:block w-72 shrink-0 border-l border-border bg-sidebar sticky top-0 h-screen overflow-y-auto p-4">
          <VideoSettingsPanel
            settings={page.videoGen.videoSettings}
            onChange={page.videoGen.setVideoSettings}
            onGenerate={page.videoGen.handleGenerateVideo}
            disabled={
              page.lastFrame.status !== 'completed' || !page.lastFrame.recordId
            }
            generating={page.videoGen.generatingVideo}
            lastFrameStatus={page.lastFrame.status}
          />
        </aside>
      )}
    </div>
  )
}
