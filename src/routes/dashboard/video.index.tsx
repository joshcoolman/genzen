import { useCallback, useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Pin, PinOff, Plus, X } from 'lucide-react'
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
  GenerationRow,
  SelectionBar,
  VideoGeneratorPanel,
  WorkspaceHeader,
  WorkspaceStrip,
  useActiveWorkspace,
  useVideoWorkspacePage,
} from '@/features/ai-video'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { useIsMobile } from '@/lib/hooks/use-is-mobile'
import { MobileDialogHeader } from '@/components/MobileDialogHeader'
import { useADOpen } from '@/lib/use-ad-open'
import { useModelSelector } from '@/components/ModelSelector'
import { cn } from '@/lib/utils'

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

  const isMobile = useIsMobile()
  const { isOpen: isADOpen } = useADOpen()

  const videoModelSelector = useModelSelector({
    capability: 'video',
    mode: 'single',
  })

  // Sync shared ModelSelector selection → videoSettings.videoModel
  useEffect(() => {
    const selectedId = videoModelSelector.selectedIds[0]
    if (selectedId && selectedId !== page.videoGen.videoSettings.videoModel) {
      page.videoGen.setVideoSettings({
        ...page.videoGen.videoSettings,
        videoModel: selectedId,
      })
    }
  }, [videoModelSelector.selectedIds])

  const handleUploadToLibrary = useCallback(
    async (file: File) => {
      await page.userImages.create({ file, title: file.name })
    },
    [page.userImages],
  )

  const headerVariant = aws.workspaceCount <= 1 ? 'minimal' : 'full'

  const userImagesData = {
    images: page.userImages.images,
    imageUrls: page.userImages.imageUrls,
    originalUrls: page.userImages.originalUrls,
    isLoading: page.userImages.isLoading,
  }

  // Panel open/pinned state — matches AI Images pattern
  const [panelOpen, setPanelOpen] = useState(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem('genzen:video-panel-open') !== 'false'
  })

  const [panelPinned, setPanelPinned] = useState(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem('genzen:video-panel-pinned') !== 'false'
  })

  useEffect(() => {
    localStorage.setItem('genzen:video-panel-open', String(panelOpen))
  }, [panelOpen])

  useEffect(() => {
    localStorage.setItem('genzen:video-panel-pinned', String(panelPinned))
  }, [panelPinned])

  return (
    <div
      className={cn(
        'transition-all duration-300',
        panelOpen && panelPinned && !isADOpen && 'mr-80',
        panelOpen && panelPinned && isADOpen && !isMobile && 'mr-[640px]',
        !panelPinned && isADOpen && !isMobile && 'mr-80',
      )}
    >
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <WorkspaceHeader
            wsName={page.wsName}
            creditBalance={page.credits.balance}
            onDelete={page.wsDelete.startDelete}
            variant={headerVariant}
          />
          {!panelOpen && (
            <button
              onClick={() => setPanelOpen(true)}
              className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-brand text-white hover:bg-accent-brand/90 transition-colors"
              title="Open video settings"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
        </div>

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

      {/* Generator panel — full-screen dialog on mobile, right sidebar on desktop */}
      {isMobile ? (
        <Dialog open={panelOpen} onOpenChange={setPanelOpen}>
          <DialogContent className="sm:max-w-full h-screen max-h-screen p-0 m-0 rounded-none border-0 flex flex-col">
            <MobileDialogHeader
              title="Video Settings"
              onClose={() => setPanelOpen(false)}
            />
            <div className="flex-1 overflow-y-auto px-3 py-2">
              <VideoGeneratorPanel
                modelSelector={videoModelSelector}
                firstFrameStatus={page.firstFrame.status}
                firstFrameUrl={page.firstFrame.url}
                firstFrameError={page.firstFrame.error}
                onFirstFrameImageFromUrl={page.firstFrameGen.setSourceFromUrl}
                lastFrameStatus={page.lastFrame.status}
                lastFrameUrl={page.lastFrame.url}
                lastFrameError={page.lastFrame.error}
                onLastFrameImageFromUrl={page.lastFrameGen.setSourceFromUrl}
                settings={page.videoGen.videoSettings}
                onSettingsChange={page.videoGen.setVideoSettings}
                onGenerate={page.videoGen.handleGenerateVideo}
                generating={page.videoGen.generatingVideo}
                userImages={userImagesData}
                onReset={page.resetAllState}
                showReset={page.firstFrame.status !== 'idle'}
                onUploadToLibrary={handleUploadToLibrary}
                creditBalance={page.credits.balance}
              />
            </div>
          </DialogContent>
        </Dialog>
      ) : (
        <>
          {/* Dismiss overlay when unpinned */}
          {panelOpen && !panelPinned && (
            <div
              className="fixed inset-0 z-20"
              onClick={() => setPanelOpen(false)}
            />
          )}

          {/* Right sidebar panel */}
          {panelOpen && (
            <div
              className={cn(
                'fixed top-0 h-screen w-80 border-l border-border bg-black/90 backdrop-blur-2xl overflow-y-auto z-30 transition-all duration-300',
                isADOpen ? 'right-80' : 'right-0',
                !panelPinned && 'shadow-xl',
              )}
            >
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <span className="text-xs text-muted-foreground">
                  Video Settings
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPanelPinned((p) => !p)}
                    className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors"
                    title={panelPinned ? 'Unpin (overlay)' : 'Pin (inline)'}
                  >
                    {panelPinned ? (
                      <Pin className="h-3.5 w-3.5" />
                    ) : (
                      <PinOff className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    onClick={() => setPanelOpen(false)}
                    className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="px-4 pb-4">
                <VideoGeneratorPanel
                  modelSelector={videoModelSelector}
                  firstFrameStatus={page.firstFrame.status}
                  firstFrameUrl={page.firstFrame.url}
                  firstFrameError={page.firstFrame.error}
                  onFirstFrameImageFromUrl={page.firstFrameGen.setSourceFromUrl}
                  lastFrameStatus={page.lastFrame.status}
                  lastFrameUrl={page.lastFrame.url}
                  lastFrameError={page.lastFrame.error}
                  onLastFrameImageFromUrl={page.lastFrameGen.setSourceFromUrl}
                  settings={page.videoGen.videoSettings}
                  onSettingsChange={page.videoGen.setVideoSettings}
                  onGenerate={page.videoGen.handleGenerateVideo}
                  generating={page.videoGen.generatingVideo}
                  userImages={userImagesData}
                  onReset={page.resetAllState}
                  showReset={page.firstFrame.status !== 'idle'}
                  onUploadToLibrary={handleUploadToLibrary}
                  creditBalance={page.credits.balance}
                />
              </div>
            </div>
          )}
        </>
      )}

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
