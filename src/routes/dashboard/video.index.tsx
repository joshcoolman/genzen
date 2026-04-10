import { useCallback, useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  ArrowUpRight,
  Group,
  Pin,
  PinOff,
  Plus,
  Trash2,
  Ungroup,
  X,
} from 'lucide-react'
import type { SavedAiVideo } from '@/features/ai-video/video-types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useAuth } from '@/lib/auth'
import { VideoGeneratorPanel } from '@/features/ai-video/components/VideoGeneratorPanel'
import { VideoGallery } from '@/features/ai-video/components/VideoGallery'
import { VideoParentPickerDialog } from '@/features/ai-video/components/VideoParentPickerDialog'
import { useVideos } from '@/features/ai-video/hooks/use-videos'
import { useVideoSidebar } from '@/features/ai-video/hooks/use-video-sidebar'
import { useReparentVideo } from '@/features/ai-video/hooks/use-reparent-video'
import { groupVideos } from '@/features/ai-video/server/group-videos.server'
import { ungroupVideos } from '@/features/ai-video/server/ungroup-videos.server'
import { useUserImages } from '@/features/user-images/hooks/useUserImages'
import { useRequireCredits } from '@/features/credits/hooks/use-require-credits'
import { CREDIT_COSTS } from '@/features/credits'
import { SelectionDrawer } from '@/components/SelectionDrawer'
import { useSelection } from '@/lib/use-selection'
import { useIsMobile } from '@/lib/hooks/use-is-mobile'
import { MobileDialogHeader } from '@/components/MobileDialogHeader'
import { useADOpen } from '@/lib/use-ad-open'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/dashboard/video/')({
  component: VideoPage,
})

function VideoPage() {
  const { user, session } = useAuth()
  const accessToken = session?.access_token
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const { isOpen: isADOpen } = useADOpen()

  const credits = useRequireCredits(CREDIT_COSTS.video_gen)

  const gallery = useVideos({ userId: user?.id, accessToken })
  const userImagesHook = useUserImages(user?.id)

  const sidebar = useVideoSidebar({
    accessToken,
    sessionParentId: null, // Main page has no session origin
    onGenerated: () => {
      // The realtime subscription will pick up the new row automatically.
    },
  })

  // Panel open/pinned state -- mirrors ai-images
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

  // Selection for bulk actions
  const selectionItems = gallery.videos.map((v) => v.id)
  const selection = useSelection({ items: selectionItems })

  const reparent = useReparentVideo({
    accessToken,
    onComplete: () => {
      void gallery.refresh()
    },
  })

  const [isBulkBusy, setIsBulkBusy] = useState(false)

  const handleOpenVideo = useCallback(
    (video: SavedAiVideo) => {
      navigate({
        to: '/dashboard/video/edit/$videoId',
        params: { videoId: video.id },
      })
    },
    [navigate],
  )

  const handleDeleteVideo = useCallback(
    async (video: SavedAiVideo) => {
      await gallery.deleteVideo(video)
    },
    [gallery],
  )

  const handleUngroupVideo = useCallback(
    async (video: SavedAiVideo) => {
      if (!accessToken) return
      try {
        await ungroupVideos({ data: { accessToken, parentId: video.id } })
        await gallery.refresh()
      } catch (err) {
        console.error('Ungroup failed', err)
      }
    },
    [accessToken, gallery],
  )

  const handleDownloadVideo = useCallback((video: SavedAiVideo) => {
    const url = video.generation_metadata?.fal_url
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = `${video.title || 'video'}.mp4`
    a.target = '_blank'
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }, [])

  const handleBulkGroup = useCallback(async () => {
    if (!accessToken) return
    const selectedIds = gallery.videos
      .filter((v) => selection.isSelected(v.id))
      .map((v) => v.id)
    if (selectedIds.length < 2) return
    const [primaryId, ...childIds] = selectedIds
    setIsBulkBusy(true)
    try {
      await groupVideos({ data: { accessToken, primaryId, childIds } })
      selection.clearSelection()
      await gallery.refresh()
    } catch (err) {
      console.error('Group failed', err)
    } finally {
      setIsBulkBusy(false)
    }
  }, [accessToken, gallery, selection])

  const handleBulkUngroup = useCallback(async () => {
    if (!accessToken) return
    const selectedParents = gallery.videos.filter((v) => {
      if (!selection.isSelected(v.id)) return false
      // Only parents (videos that have at least one child in the gallery)
      return gallery.videos.some(
        (c) => c.generation_metadata?.parent_id === v.id,
      )
    })
    if (selectedParents.length === 0) return
    setIsBulkBusy(true)
    try {
      await Promise.all(
        selectedParents.map((p) =>
          ungroupVideos({ data: { accessToken, parentId: p.id } }),
        ),
      )
      selection.clearSelection()
      await gallery.refresh()
    } catch (err) {
      console.error('Bulk ungroup failed', err)
    } finally {
      setIsBulkBusy(false)
    }
  }, [accessToken, gallery, selection])

  const handleBulkMove = useCallback(() => {
    const selected = gallery.videos.filter((v) => selection.isSelected(v.id))
    if (selected.length === 0) return
    reparent.startAdoptBatch(selected)
  }, [gallery.videos, selection, reparent])

  const hasSelectedParent = gallery.videos.some(
    (v) =>
      selection.isSelected(v.id) &&
      gallery.videos.some((c) => c.generation_metadata?.parent_id === v.id),
  )

  const handleUploadToLibrary = useCallback(
    async (file: File) => {
      await userImagesHook.create({ file, title: file.name })
    },
    [userImagesHook],
  )

  const userImagesData = {
    images: userImagesHook.images,
    imageUrls: userImagesHook.imageUrls,
    originalUrls: userImagesHook.originalUrls,
    isLoading: userImagesHook.isLoading,
  }

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
          <div>
            <h1 className="text-lg font-medium">AI Video</h1>
            <p className="text-xs text-muted-foreground">
              {credits.balance !== null ? `${credits.balance} credits` : ''}
            </p>
          </div>
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

        <VideoGallery
          videos={gallery.videos}
          thumbnailUrls={gallery.thumbnailUrls}
          loadingGallery={gallery.loadingGallery}
          thumbSize="lg"
          showInfo
          onOpen={handleOpenVideo}
          onDelete={handleDeleteVideo}
          onStartAdopt={reparent.startAdopt}
          onUnlink={(v) => void reparent.detach(v.id)}
          onUngroup={(v) => void handleUngroupVideo(v)}
          onDownload={handleDownloadVideo}
          onCaptureFrame={gallery.captureFrame}
          onRemoveThumb={gallery.removeThumbnail}
          selectionActive={selection.count > 0}
          isSelected={selection.isSelected}
          onSelect={selection.toggle}
        />

        <SelectionDrawer
          count={selection.count}
          onClear={selection.clearSelection}
        >
          {selection.count >= 2 && (
            <Button
              variant="ghost"
              size="sm"
              disabled={isBulkBusy}
              onClick={() => void handleBulkGroup()}
            >
              <Group className="mr-1 h-3 w-3" />
              {isBulkBusy ? 'Grouping...' : 'Group'}
            </Button>
          )}
          {hasSelectedParent && (
            <Button
              variant="ghost"
              size="sm"
              disabled={isBulkBusy}
              onClick={() => void handleBulkUngroup()}
            >
              <Ungroup className="mr-1 h-3 w-3" />
              {isBulkBusy ? 'Ungrouping...' : 'Ungroup'}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            disabled={reparent.isReparenting}
            onClick={handleBulkMove}
          >
            <ArrowUpRight className="mr-1 h-3 w-3" />
            {reparent.isReparenting ? 'Moving...' : `Move (${selection.count})`}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={async () => {
              for (const v of gallery.videos) {
                if (selection.isSelected(v.id)) {
                  await gallery.deleteVideo(v)
                }
              }
              selection.clearSelection()
            }}
          >
            <Trash2 className="mr-1 h-3 w-3" />
            Delete ({selection.count})
          </Button>
        </SelectionDrawer>

        {reparent.adoptTarget && (
          <VideoParentPickerDialog
            open={!!reparent.adoptTarget}
            onOpenChange={(open) => {
              if (!open) reparent.cancelAdopt()
            }}
            movingVideo={reparent.adoptTarget}
            movingVideoUrl={gallery.thumbnailUrls[reparent.adoptTarget.id]}
            movingVideos={reparent.adoptBatch ?? undefined}
            videos={gallery.videos}
            thumbnailUrls={gallery.thumbnailUrls}
            loading={reparent.isReparenting}
            onConfirm={(newParentId) => {
              void reparent.confirmAdopt(newParentId).then(() => {
                selection.clearSelection()
              })
            }}
          />
        )}
      </div>

      {/* Generator sidebar -- mobile = fullscreen dialog, desktop = pinnable panel */}
      {isMobile ? (
        <Dialog open={panelOpen} onOpenChange={setPanelOpen}>
          <DialogContent className="sm:max-w-full h-screen max-h-screen p-0 m-0 rounded-none border-0 flex flex-col">
            <MobileDialogHeader
              title="Video"
              onClose={() => setPanelOpen(false)}
            />
            <div className="flex-1 overflow-y-auto px-3 py-2">
              <VideoGeneratorPanel
                sidebar={sidebar}
                userImages={userImagesData}
                onUploadToLibrary={handleUploadToLibrary}
                creditBalance={credits.balance}
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
                <span className="text-xs text-muted-foreground">Video</span>
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
                  sidebar={sidebar}
                  userImages={userImagesData}
                  onUploadToLibrary={handleUploadToLibrary}
                  creditBalance={credits.balance}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
