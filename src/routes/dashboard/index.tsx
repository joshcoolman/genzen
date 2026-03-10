import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { LayoutGrid, Settings } from 'lucide-react'
import type { UserImage } from '@/features/user-images/types'
import { useAccountStatus } from '@/lib/account-status'
import { useAuth } from '@/lib/auth'
import { useUserImages } from '@/features/user-images/hooks/useUserImages'
import { getVideoUrl, getWorkspaces } from '@/features/ai-video'
import { VideoPlayerDialog } from '@/components/video-player-dialog'
import { SectionCard } from '@/components/SectionCard'
import { ImageResultCard } from '@/components/ImageResultCard'
import { ImageGrid } from '@/components/ImageGrid'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/dashboard/')({
  component: DashboardHome,
})

type FeedItemType =
  | 'upload'
  | 'ai_upload'
  | 'ai_image'
  | 'ai_video'
  | 'workspace'

type FeedItem = {
  id: string
  type: FeedItemType
  createdAt: string
  thumbnailUrl: string | null
  label: string
  href: string
  workspaceId?: string
  generationId?: string
  videoReady?: boolean
}

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
  generations: Array<{
    id: string
    createdAt: string
    firstFrameUrl: string | null
    videoReady: boolean
  }>
}

function buildFeed(
  images: Array<UserImage>,
  imageUrls: Record<string, string>,
  workspaces: Array<Workspace>,
  opts: { showWorkspaces: boolean; showAllUploads: boolean },
): Array<FeedItem> {
  const imgItems: Array<FeedItem> = images
    .filter((img) => {
      if (opts.showAllUploads) return true
      const meta = img.generation_metadata as Record<string, unknown> | null
      return !meta?.frame_type
    })
    .map((img) => {
      const meta = img.generation_metadata as Record<string, unknown> | null
      const isAiUpload = img.source === 'upload' && !!meta?.frame_type
      return {
        id: img.id,
        type: isAiUpload
          ? 'ai_upload'
          : img.source === 'upload'
            ? 'upload'
            : 'ai_image',
        createdAt: img.created_at,
        thumbnailUrl: imageUrls[img.id] ?? null,
        label: img.title,
        href:
          img.source === 'upload'
            ? '/dashboard/images'
            : '/dashboard/ai-images',
      }
    })

  const vidItems: Array<FeedItem> = workspaces.flatMap((ws) =>
    ws.generations.map((gen) => ({
      id: gen.id,
      type: 'ai_video' as const,
      createdAt: gen.createdAt,
      thumbnailUrl: gen.firstFrameUrl,
      label: ws.name,
      href: `/dashboard/video/${ws.id}?generationId=${gen.id}`,
      workspaceId: ws.id,
      generationId: gen.id,
      videoReady: gen.videoReady,
    })),
  )

  const wsItems: Array<FeedItem> = opts.showWorkspaces
    ? workspaces.map((ws) => ({
        id: `ws-${ws.id}`,
        type: 'workspace' as const,
        createdAt: ws.createdAt,
        thumbnailUrl: ws.preview.heroUrl,
        label: ws.name,
        href: `/dashboard/video/${ws.id}`,
        workspaceId: ws.id,
      }))
    : []

  return [...wsItems, ...imgItems, ...vidItems].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}

const TYPE_LABELS: Record<FeedItemType, string> = {
  upload: 'Upload',
  ai_upload: 'AI Upload',
  ai_image: 'Image',
  ai_video: 'Video',
  workspace: 'Workspace',
}

const TYPE_COLORS: Record<FeedItemType, string> = {
  upload: 'bg-emerald-600/80',
  ai_upload: 'bg-zinc-500/80',
  ai_image: 'bg-violet-600/80',
  ai_video: 'bg-blue-600/80',
  workspace: 'bg-amber-600/80',
}

type TypeFilter = 'all' | FeedItemType

const DASH_PREFS_KEY = 'dashboard-view-prefs'
const THUMB_SIZES = ['lg', 'md', 'sm'] as const
const THUMB_LABELS: Record<(typeof THUMB_SIZES)[number], string> = {
  lg: 'LG',
  md: 'MD',
  sm: 'SM',
}

interface DashPrefs {
  thumbSize: 'lg' | 'md' | 'sm'
}

function getDashPrefs(): DashPrefs {
  try {
    const stored = localStorage.getItem(DASH_PREFS_KEY)
    if (stored) return { thumbSize: 'lg', ...JSON.parse(stored) }
  } catch {}
  return { thumbSize: 'lg' }
}

function storeDashPrefs(update: Partial<DashPrefs>) {
  try {
    const current = getDashPrefs()
    localStorage.setItem(
      DASH_PREFS_KEY,
      JSON.stringify({ ...current, ...update }),
    )
  } catch {}
}

function TypeBadge({ type }: { type: FeedItemType }) {
  return (
    <div
      className={`absolute bottom-1.5 left-1.5 ${TYPE_COLORS[type]} backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded`}
    >
      {TYPE_LABELS[type]}
    </div>
  )
}

function VideoPlayButton({ onClick }: { onClick: () => void }) {
  return (
    <div
      role="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-black/80 transition-colors"
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 14 14"
        fill="none"
        className="ml-0.5 text-white"
      >
        <path
          d="M3.5 2.5L11.5 7L3.5 11.5V2.5Z"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}

function VideoProcessing() {
  return (
    <div className="absolute bottom-1.5 right-1.5 text-yellow-400 text-[10px] px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm">
      Processing...
    </div>
  )
}

function EmptyThumbnail({
  label,
  type,
}: {
  label: string
  type: FeedItemType
}) {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-2 p-4">
      <p className="text-xs font-medium text-muted-foreground text-center line-clamp-2">
        {label}
      </p>
      <span className="text-[10px] text-muted-foreground/60">
        {TYPE_LABELS[type]}
      </span>
    </div>
  )
}

function DashboardHome() {
  const accountStatus = useAccountStatus()
  const { session } = useAuth()
  const navigate = useNavigate()
  const user = session?.user

  const {
    images,
    imageUrls,
    isLoading: imagesLoading,
  } = useUserImages(user?.id)

  const [workspaces, setWorkspaces] = useState<Array<Workspace>>([])
  const [workspacesLoading, setWorkspacesLoading] = useState(true)
  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null)
  const [videoDialogOpen, setVideoDialogOpen] = useState(false)
  const [viewSettings, setViewSettings] = useState({
    showWorkspaces: false,
    showAllUploads: false,
  })
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')

  const [storedPrefs] = useState(getDashPrefs)
  const [thumbSize, setThumbSize] = useState<'lg' | 'md' | 'sm'>(
    storedPrefs.thumbSize,
  )

  const handleToggleThumbSize = () => {
    setThumbSize((v) => {
      const idx = THUMB_SIZES.indexOf(v)
      const next = THUMB_SIZES[(idx + 1) % THUMB_SIZES.length]
      storeDashPrefs({ thumbSize: next })
      return next
    })
  }

  useEffect(() => {
    if (!session?.access_token) return
    getWorkspaces({ data: { accessToken: session.access_token } })
      .then(setWorkspaces)
      .catch(() => {})
      .finally(() => setWorkspacesLoading(false))
  }, [session?.access_token])

  if (accountStatus !== 'active') {
    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-semibold">Everything</h1>
        <SectionCard>
          <div className="text-center space-y-3">
            <h2 className="text-xl font-semibold text-accent-brand">
              You're on the list
            </h2>
            <p className="text-muted-foreground">
              Thanks for signing up. We'll let you know when your account is
              activated.
            </p>
          </div>
        </SectionCard>
      </div>
    )
  }

  const handlePlayVideo = async (generationId: string) => {
    if (!session?.access_token) return
    const result = await getVideoUrl({
      data: { generationId, accessToken: session.access_token },
    })
    if (result.videoUrl) {
      setActiveVideoUrl(result.videoUrl)
      setVideoDialogOpen(true)
    }
  }

  const handleItemClick = (item: FeedItem) => {
    if (item.type === 'ai_video' && item.workspaceId) {
      void navigate({
        to: '/dashboard/video/$workspaceId',
        params: { workspaceId: item.workspaceId },
        search: { generationId: item.generationId },
      })
    } else if (item.type === 'workspace' && item.workspaceId) {
      void navigate({
        to: '/dashboard/video/$workspaceId',
        params: { workspaceId: item.workspaceId },
        search: { generationId: undefined },
      })
    } else if (item.href === '/dashboard/images') {
      void navigate({
        to: '/dashboard/images',
        search: { imageId: item.id },
      })
    } else {
      void navigate({
        to: item.href as '/dashboard/ai-images',
      })
    }
  }

  const loading = imagesLoading || workspacesLoading
  const feed = buildFeed(images, imageUrls, workspaces, viewSettings)
  const filteredFeed =
    typeFilter === 'all'
      ? feed
      : typeFilter === 'upload'
        ? feed.filter(
            (item) => item.type === 'upload' || item.type === 'ai_upload',
          )
        : feed.filter((item) => item.type === typeFilter)

  const pillFilters: Array<TypeFilter> = [
    'all',
    'upload',
    'ai_image',
    'ai_video',
    ...(viewSettings.showWorkspaces ? (['workspace'] as const) : []),
  ]

  const compact = thumbSize !== 'lg'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {pillFilters.map((f) => (
            <button
              key={f}
              onClick={() => setTypeFilter(f)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                typeFilter === f
                  ? 'bg-foreground text-background border-foreground'
                  : 'border-border text-muted-foreground hover:border-foreground/40',
              )}
            >
              {f === 'all' ? 'All' : TYPE_LABELS[f]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
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
          <Popover>
            <PopoverTrigger asChild>
              <button className="p-1.5 rounded-md hover:bg-muted transition-colors">
                <Settings className="w-4 h-4 text-muted-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-52 p-3 space-y-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={viewSettings.showWorkspaces}
                  onCheckedChange={(checked) =>
                    setViewSettings((s) => ({
                      ...s,
                      showWorkspaces: checked === true,
                    }))
                  }
                />
                Show workspaces
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={viewSettings.showAllUploads}
                  onCheckedChange={(checked) =>
                    setViewSettings((s) => ({
                      ...s,
                      showAllUploads: checked === true,
                    }))
                  }
                />
                Show all uploads
              </label>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : filteredFeed.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-sm text-muted-foreground">No assets yet</p>
        </div>
      ) : (
        <ImageGrid size={thumbSize}>
          {filteredFeed.map((item) => (
            <ImageResultCard
              key={item.id}
              url={item.thumbnailUrl}
              alt={item.label}
              onClick={() => handleItemClick(item)}
              objectFit="cover"
              compact={compact}
              asButton
              hoverBorder="hover:border-foreground/30"
              fallback={<EmptyThumbnail label={item.label} type={item.type} />}
              imageOverlay={
                <>
                  {typeFilter === 'all' && <TypeBadge type={item.type} />}
                  {item.type === 'ai_video' &&
                    item.videoReady &&
                    item.generationId && (
                      <VideoPlayButton
                        onClick={() => void handlePlayVideo(item.generationId!)}
                      />
                    )}
                  {item.type === 'ai_video' && !item.videoReady && (
                    <VideoProcessing />
                  )}
                </>
              }
            />
          ))}
        </ImageGrid>
      )}

      <VideoPlayerDialog
        videoUrl={activeVideoUrl}
        open={videoDialogOpen}
        onOpenChange={setVideoDialogOpen}
      />
    </div>
  )
}
