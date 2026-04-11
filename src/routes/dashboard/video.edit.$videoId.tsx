import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Pin, PinOff, Plus, X } from 'lucide-react'
import type { SavedAiVideo } from '@/features/ai-video/video-types'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useAuth } from '@/lib/auth'
import { VideoGeneratorPanel } from '@/features/ai-video/components/VideoGeneratorPanel'
import { VideoGallery } from '@/features/ai-video/components/VideoGallery'
import { useVideos } from '@/features/ai-video/hooks/use-videos'
import { useVideoSidebar } from '@/features/ai-video/hooks/use-video-sidebar'
import { buildPendingVideo } from '@/features/ai-video/lib/build-pending-video'
import { useUserImages } from '@/features/user-images/hooks/useUserImages'
import { useRequireCredits } from '@/features/credits/hooks/use-require-credits'
import { CREDIT_COSTS } from '@/features/credits'
import { useIsMobile } from '@/lib/hooks/use-is-mobile'
import { MobileDialogHeader } from '@/components/MobileDialogHeader'
import { useADOpen } from '@/lib/use-ad-open'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/dashboard/video/edit/$videoId')({
  component: VideoEditPage,
})

function VideoEditPage() {
  const { videoId } = Route.useParams()
  const { user, session } = useAuth()
  const accessToken = session?.access_token
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const { isOpen: isADOpen } = useADOpen()

  const credits = useRequireCredits(CREDIT_COSTS.video_gen)
  const gallery = useVideos({ userId: user?.id, accessToken })
  const userImagesHook = useUserImages(user?.id)

  // Find the origin video. Resolves null during initial load.
  const originVideo: SavedAiVideo | null = useMemo(() => {
    return gallery.videos.find((v) => v.id === videoId) ?? null
  }, [gallery.videos, videoId])

  // Session parent: origin's parent if it has one, else origin itself.
  // Sticky for the lifetime of this route.
  const sessionParentId = useMemo(() => {
    if (!originVideo) return null
    return originVideo.generation_metadata?.parent_id ?? originVideo.id
  }, [originVideo])

  // Highlighted thumb: defaults to origin, swaps when you click siblings, swaps
  // to placeholder on generate. Cleared on mode toggle / clear prompts.
  const [highlightedId, setHighlightedId] = useState<string | null>(null)

  const sidebar = useVideoSidebar({
    accessToken,
    sessionParentId,
    onOptimistic: (id, state) => {
      gallery.addOptimisticCard(buildPendingVideo(id, state, sessionParentId))
      // Highlight the pending card the same frame it appears.
      setHighlightedId(id)
    },
    onError: (id, err) => gallery.markOptimisticFailed(id, err),
    onGenerated: (result) => {
      setHighlightedId(result.recordId)
    },
  })

  // Rehydrate sidebar + highlight when origin video first resolves.
  const [rehydrated, setRehydrated] = useState(false)
  useEffect(() => {
    if (originVideo && !rehydrated) {
      sidebar.loadFromVideo(originVideo)
      setHighlightedId(originVideo.id)
      setRehydrated(true)
    }
  }, [originVideo, rehydrated, sidebar])

  // Scope the gallery to just this group: origin video + all videos sharing
  // the same session parent.
  const scopedIds = useMemo(() => {
    const ids = new Set<string>()
    if (sessionParentId) ids.add(sessionParentId)
    for (const v of gallery.videos) {
      const pid = v.generation_metadata?.parent_id
      if (pid === sessionParentId) ids.add(v.id)
    }
    return ids
  }, [gallery.videos, sessionParentId])

  // Clicking a thumb in the main area = load its snapshot into sidebar,
  // highlight it. The sidebar replaces wholesale (no dual-mode retention).
  const handleOpenThumb = useCallback(
    (video: SavedAiVideo) => {
      sidebar.loadFromVideo(video)
      setHighlightedId(video.id)
    },
    [sidebar],
  )

  // Wrap mode toggle to clear highlight (sidebar no longer represents any thumb)
  const handleModeToggle = useCallback(
    (mode: 'flf' | 'multishot') => {
      sidebar.setMode(mode)
      setHighlightedId(null)
    },
    [sidebar],
  )

  // Wrap clear prompts to clear highlight
  const handleClearPrompts = useCallback(() => {
    sidebar.clearPrompts()
    setHighlightedId(null)
  }, [sidebar])

  // Decorate the sidebar return with our wrapped setters so the panel uses them
  const decoratedSidebar = useMemo(
    () => ({
      ...sidebar,
      setMode: handleModeToggle,
      clearPrompts: handleClearPrompts,
    }),
    [sidebar, handleModeToggle, handleClearPrompts],
  )

  // Panel open/pinned state -- mirrors main page
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

  const handleDeleteVideo = useCallback(
    async (video: SavedAiVideo) => {
      await gallery.deleteVideo(video)
      if (highlightedId === video.id) setHighlightedId(null)
      // If we deleted the origin, bounce back to main
      if (video.id === sessionParentId) {
        navigate({ to: '/dashboard/video' })
      }
    },
    [gallery, highlightedId, sessionParentId, navigate],
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

  // Loading state
  if (gallery.loadingGallery && !originVideo) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    )
  }

  if (!originVideo && !gallery.loadingGallery) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <p className="text-sm text-muted-foreground">Video not found.</p>
        <Link
          to="/dashboard/video"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to all generations
        </Link>
      </div>
    )
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
          <Link
            to="/dashboard/video"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to all generations
          </Link>
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
          scopedIds={scopedIds}
          activeId={highlightedId ?? undefined}
          allowDelete
          onOpen={handleOpenThumb}
          onDelete={handleDeleteVideo}
          onCaptureFrame={gallery.captureFrame}
          onRemoveThumb={gallery.removeThumbnail}
        />
      </div>

      {/* Sidebar -- same component as main page */}
      {isMobile ? (
        <Dialog open={panelOpen} onOpenChange={setPanelOpen}>
          <DialogContent className="sm:max-w-full h-screen max-h-screen p-0 m-0 rounded-none border-0 flex flex-col">
            <MobileDialogHeader
              title="Edit Video"
              onClose={() => setPanelOpen(false)}
            />
            <div className="flex-1 overflow-y-auto px-3 py-2">
              <VideoGeneratorPanel
                sidebar={decoratedSidebar}
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
                <span className="text-xs text-muted-foreground">Edit</span>
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
                  sidebar={decoratedSidebar}
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
