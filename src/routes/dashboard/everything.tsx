import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import type { UserImage } from '@/features/user-images/types'
import { useAuth } from '@/lib/auth'
import { useUserImages } from '@/features/user-images/hooks/useUserImages'
import { getWorkspaces } from '@/features/ai-video/server/get-workspaces.server'

export const Route = createFileRoute('/dashboard/everything')({
  component: EverythingPage,
})

type FeedItemType = 'upload' | 'ai_image' | 'ai_video'

type FeedItem = {
  id: string
  type: FeedItemType
  createdAt: string
  thumbnailUrl: string | null
  label: string
  href: string
  workspaceId?: string
  generationId?: string
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
  }>
}

function buildFeed(
  images: Array<UserImage>,
  imageUrls: Record<string, string>,
  workspaces: Array<Workspace>,
): Array<FeedItem> {
  const imgItems: Array<FeedItem> = images.map((img) => ({
    id: img.id,
    type: img.source === 'upload' ? 'upload' : 'ai_image',
    createdAt: img.created_at,
    thumbnailUrl: imageUrls[img.id] ?? null,
    label: img.title,
    href:
      img.source === 'upload' ? '/dashboard/images' : '/dashboard/ai-images',
  }))

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
    })),
  )

  return [...imgItems, ...vidItems].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}

const TYPE_LABELS: Record<FeedItemType, string> = {
  upload: 'Upload',
  ai_image: 'AI Image',
  ai_video: 'AI Video',
}

function FeedCard({ item, onClick }: { item: FeedItem; onClick: () => void }) {
  if (!item.thumbnailUrl) {
    return (
      <button
        onClick={onClick}
        className="aspect-square rounded-lg border border-dashed border-border flex flex-col items-center justify-center gap-2 hover:border-foreground/30 transition-colors p-4"
      >
        <p className="text-xs font-medium text-muted-foreground text-center line-clamp-2">
          {item.label}
        </p>
        <span className="text-[10px] text-muted-foreground/60">
          {TYPE_LABELS[item.type]}
        </span>
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      className="group relative aspect-square rounded-lg border border-border overflow-hidden hover:border-foreground/30 transition-colors"
    >
      <img
        src={item.thumbnailUrl}
        alt={item.label}
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute bottom-1.5 left-1.5 bg-black/60 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded">
        {TYPE_LABELS[item.type]}
      </div>
    </button>
  )
}

function EverythingPage() {
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

  useEffect(() => {
    if (!session?.access_token) return
    getWorkspaces({ data: { accessToken: session.access_token } })
      .then(setWorkspaces)
      .catch(() => {})
      .finally(() => setWorkspacesLoading(false))
  }, [session?.access_token])

  const loading = imagesLoading || workspacesLoading
  const feed = buildFeed(images, imageUrls, workspaces)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Everything</h1>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : feed.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-sm text-muted-foreground">No assets yet</p>
        </div>
      ) : (
        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          }}
        >
          {feed.map((item) => (
            <FeedCard
              key={item.id}
              item={item}
              onClick={() => {
                if (item.type === 'ai_video' && item.workspaceId) {
                  void navigate({
                    to: '/dashboard/video/$workspaceId',
                    params: { workspaceId: item.workspaceId },
                    search: { generationId: item.generationId },
                  })
                } else {
                  void navigate({
                    to: item.href as
                      | '/dashboard/images'
                      | '/dashboard/ai-images',
                  })
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
