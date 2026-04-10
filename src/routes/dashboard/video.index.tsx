import { useCallback, useEffect, useMemo, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  ArrowDown,
  ArrowUp,
  Info,
  LayoutGrid,
  Pin,
  PinOff,
  Plus,
  X,
} from 'lucide-react'
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
  VideoGeneratorPanel,
  WorkspaceHeader,
  WorkspaceStrip,
  useActiveWorkspace,
  useVideoWorkspacePage,
} from '@/features/ai-video'
import { VideoGallery } from '@/features/ai-video/components/VideoGallery'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { SelectionDrawer } from '@/components/SelectionDrawer'
import { useSelection } from '@/lib/use-selection'
import { useIsMobile } from '@/lib/hooks/use-is-mobile'
import { MobileDialogHeader } from '@/components/MobileDialogHeader'
import { useADOpen } from '@/lib/use-ad-open'
import { useModelSelector } from '@/components/ModelSelector'
import { cn } from '@/lib/utils'
import { deleteGeneration as deleteGenerationServer } from '@/features/ai-video/server/delete-generation.server'

export const Route = createFileRoute('/dashboard/video/')({
  validateSearch: (search: Record<string, unknown>) => ({
    workspaceId:
      typeof search.workspaceId === 'string' ? search.workspaceId : undefined,
    generationId:
      typeof search.generationId === 'string' ? search.generationId : undefined,
  }),
  component: VideoPage,
})

// -- Gallery prefs --

const PREFS_KEY = 'genzen:video-prefs'
const THUMB_LABELS: Record<string, string> = { lg: 'Lg', md: 'Md', sm: 'Sm' }
const THUMB_CYCLE: Record<string, 'lg' | 'md' | 'sm'> = {
  lg: 'md',
  md: 'sm',
  sm: 'lg',
}

interface VideoPrefs {
  thumbSize: 'lg' | 'md' | 'sm'
  sortAsc: boolean
  showInfo: boolean
}

function getStoredPrefs(): VideoPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (raw) return JSON.parse(raw) as VideoPrefs
  } catch {}
  return { thumbSize: 'lg', sortAsc: false, showInfo: true }
}

function storePrefs(partial: Partial<VideoPrefs>) {
  try {
    const current = getStoredPrefs()
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...current, ...partial }))
  } catch {}
}

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

  // Panel open/pinned state
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

  // Gallery prefs
  const [storedPrefs] = useState(getStoredPrefs)
  const [thumbSize, setThumbSize] = useState(storedPrefs.thumbSize)
  const [sortAsc, setSortAsc] = useState(storedPrefs.sortAsc)
  const [showInfo, setShowInfo] = useState(storedPrefs.showInfo)

  const handleToggleThumbSize = useCallback(() => {
    setThumbSize((v) => {
      const next = THUMB_CYCLE[v]
      storePrefs({ thumbSize: next })
      return next
    })
  }, [])

  const handleToggleSort = useCallback(() => {
    setSortAsc((v) => {
      storePrefs({ sortAsc: !v })
      return !v
    })
  }, [])

  const handleToggleInfo = useCallback(() => {
    setShowInfo((v) => {
      storePrefs({ showInfo: !v })
      return !v
    })
  }, [])

  // Active first frame (clicked card) -- loads into sidebar
  const [activeFirstFrameId, setActiveFirstFrameId] = useState<string | null>(
    null,
  )

  const handleActivateFirstFrame = useCallback(
    (firstFrameId: string) => {
      setActiveFirstFrameId(firstFrameId)
      // Load the first frame into the sidebar
      const group = page.gens.firstFrameGroups.find(
        (g) => g.firstFrameId === firstFrameId,
      )
      if (group?.firstFrameUrl) {
        page.firstFrameGen.setSourceFromUrl(group.firstFrameUrl, 'first-frame')
      }
      // Open panel if closed
      if (!panelOpen) setPanelOpen(true)
    },
    [page.gens.firstFrameGroups, page.firstFrameGen, panelOpen],
  )

  const handleDeactivateFirstFrame = useCallback(() => {
    setActiveFirstFrameId(null)
  }, [])

  // Sort groups
  const sortedGroups = useMemo(() => {
    const groups = [...page.gens.firstFrameGroups]
    groups.sort((a, b) =>
      sortAsc
        ? a.latestDate.localeCompare(b.latestDate)
        : b.latestDate.localeCompare(a.latestDate),
    )
    return groups
  }, [page.gens.firstFrameGroups, sortAsc])

  // Selection on first frame IDs
  const selectionItems = useMemo(
    () => sortedGroups.map((g) => g.firstFrameId),
    [sortedGroups],
  )
  const selection = useSelection({ items: selectionItems })

  // Delete a single generation
  const handleDeleteGeneration = useCallback(
    async (id: string) => {
      if (!page.accessToken) return
      try {
        await deleteGenerationServer({
          data: { generationId: id, accessToken: page.accessToken },
        })
        page.gens.deleteGeneration(id)
      } catch (err) {
        console.error('Failed to delete generation:', err)
      }
    },
    [page.accessToken, page.gens],
  )

  // Delete all generations in a group
  const handleDeleteGroup = useCallback(
    async (generationIds: Array<string>) => {
      if (!page.accessToken) return
      for (const id of generationIds) {
        try {
          await deleteGenerationServer({
            data: { generationId: id, accessToken: page.accessToken },
          })
          page.gens.deleteGeneration(id)
        } catch (err) {
          console.error('Failed to delete generation:', err)
        }
      }
      setActiveFirstFrameId(null)
    },
    [page.accessToken, page.gens],
  )

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

        {aws.workspaceCount >= 2 && !activeFirstFrameId && (
          <WorkspaceStrip
            workspaces={aws.workspaces}
            activeWorkspaceId={aws.activeWorkspaceId}
            onSelect={aws.setActiveWorkspaceId}
            onCreateNew={() => aws.setDialogOpen(true)}
          />
        )}

        {/* Gallery toolbar -- hidden in detail view */}
        <div
          className={cn(
            'flex items-center justify-between',
            activeFirstFrameId && 'hidden',
          )}
        >
          <h2 className="text-sm font-medium">Generations</h2>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleToggleThumbSize}
              className="flex w-14 items-center justify-center gap-1 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label={`Thumbnail size: ${THUMB_LABELS[thumbSize]}`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="text-[10px] font-medium">
                {THUMB_LABELS[thumbSize]}
              </span>
            </button>
            <button
              onClick={handleToggleSort}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label={sortAsc ? 'Sort oldest first' : 'Sort newest first'}
            >
              {sortAsc ? (
                <ArrowUp className="h-4 w-4" />
              ) : (
                <ArrowDown className="h-4 w-4" />
              )}
            </button>
            <button
              onClick={handleToggleInfo}
              className={`rounded-md p-1.5 transition-colors ${
                showInfo
                  ? 'text-foreground bg-muted'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
              aria-label={showInfo ? 'Hide info' : 'Show info'}
            >
              <Info className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Video gallery grid */}
        <VideoGallery
          groups={sortedGroups}
          thumbSize={thumbSize}
          showInfo={showInfo}
          activeFirstFrameId={activeFirstFrameId}
          onActivate={handleActivateFirstFrame}
          onDeactivate={handleDeactivateFirstFrame}
          selectionActive={selection.count > 0}
          isSelected={selection.isSelected}
          onSelect={selection.toggle}
          onLoad={page.handleLoadGeneration}
          onContinue={page.handleContinueGeneration}
          onDelete={handleDeleteGeneration}
          onDeleteGroup={handleDeleteGroup}
          onGenerateVideo={page.videoGen.handleGenerateVideoFromRow}
          accessToken={page.accessToken}
        />

        {/* Selection drawer */}
        <SelectionDrawer
          count={selection.count}
          onClear={selection.clearSelection}
        >
          <Button
            size="sm"
            onClick={() => {
              // Collect all generation IDs from selected groups
              const ids = new Set<string>()
              for (const group of sortedGroups) {
                if (selection.isSelected(group.firstFrameId)) {
                  for (const gen of group.generations) {
                    ids.add(gen.id)
                  }
                }
              }
              if (ids.size > 0) {
                handleDeleteGroup([...ids])
                selection.clearSelection()
              }
            }}
            variant="destructive"
          >
            Delete selected
          </Button>
        </SelectionDrawer>
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
          {panelOpen && !panelPinned && (
            <div
              className="fixed inset-0 z-20"
              onClick={() => setPanelOpen(false)}
            />
          )}

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
