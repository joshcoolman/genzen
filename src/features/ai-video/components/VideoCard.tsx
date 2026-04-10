import { useState } from 'react'
import { Play, Trash2 } from 'lucide-react'
import type { SavedAiVideo } from '../video-types'
import { Thumbnail } from '@/components/Thumbnail'
import { ExpandableIconButton } from '@/components/ExpandableIconButton'
import { VideoPlayerDialog } from '@/components/video-player-dialog'
import { cn } from '@/lib/utils'

interface VideoCardProps {
  video: SavedAiVideo
  thumbnailUrl: string | null
  /** Children of this video (for nested thumbs under the parent card). */
  children?: Array<{ video: SavedAiVideo; thumbnailUrl: string | null }>
  showInfo?: boolean
  active?: boolean
  selected?: boolean
  selectionActive?: boolean
  onOpen?: (video: SavedAiVideo) => void
  onSelect?: (id: string, shiftKey: boolean) => void
  onDelete?: (video: SavedAiVideo) => void
}

function getVideoUrl(video: SavedAiVideo): string | null {
  return video.generation_metadata?.fal_url ?? null
}

export function VideoCard({
  video,
  thumbnailUrl,
  children,
  showInfo = true,
  active = false,
  selected = false,
  selectionActive = false,
  onOpen,
  onSelect,
  onDelete,
}: VideoCardProps) {
  const [playerOpen, setPlayerOpen] = useState(false)
  const [playingUrl, setPlayingUrl] = useState<string | null>(null)

  const childCount = children?.length ?? 0
  const videoUrl = getVideoUrl(video)
  const isPending = video.status === 'pending' || video.status === 'processing'
  const thumbnailStatus = isPending
    ? 'pending'
    : video.status === 'failed'
      ? 'failed'
      : 'complete'

  const handleClick = (e?: React.MouseEvent) => {
    if (selectionActive && onSelect) {
      onSelect(video.id, e?.shiftKey ?? false)
    } else {
      onOpen?.(video)
    }
  }

  const handlePlay = (url: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setPlayingUrl(url)
    setPlayerOpen(true)
  }

  return (
    <>
      <Thumbnail
        url={thumbnailUrl}
        objectFit="cover"
        status={thumbnailStatus}
        pendingLabel="Processing..."
        pendingBackgroundUrl={thumbnailUrl ?? undefined}
        selected={selected || active}
        selectedClassName={
          active
            ? 'border-accent-brand ring-1 ring-accent-brand'
            : 'border-primary ring-1 ring-primary'
        }
        onClick={handleClick}
        topLeftBadge={
          childCount > 0
            ? `${childCount + 1} ${childCount + 1 === 1 ? 'video' : 'videos'}`
            : undefined
        }
        overlayActions={
          onDelete ? (
            <ExpandableIconButton
              icon={<Trash2 className="h-3.5 w-3.5" />}
              label="Delete"
              variant="destructive"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(video)
              }}
            />
          ) : undefined
        }
        overlayActionsBottomRight={
          videoUrl && !isPending ? (
            <button
              onClick={(e) => handlePlay(videoUrl, e)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm text-foreground hover:bg-background transition-colors"
            >
              <Play className="h-4 w-4 ml-0.5" fill="currentColor" />
            </button>
          ) : undefined
        }
        footer={
          showInfo ? (
            <div className="px-3 py-2 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">
                  {new Date(video.created_at).toLocaleDateString()}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {childCount + 1} gens
                </span>
              </div>
              {childCount > 0 && children && (
                <div className="flex gap-1">
                  {children.slice(0, 4).map((c) => {
                    const cvUrl = getVideoUrl(c.video)
                    return (
                      <button
                        key={c.video.id}
                        onClick={(e) =>
                          cvUrl ? handlePlay(cvUrl, e) : e.stopPropagation()
                        }
                        className={cn(
                          'relative w-10 h-10 rounded bg-black flex items-center justify-center',
                          'border border-border hover:border-foreground/30 transition-colors',
                        )}
                      >
                        {c.thumbnailUrl && (
                          <img
                            src={c.thumbnailUrl}
                            alt=""
                            className="absolute inset-0 w-full h-full object-cover rounded opacity-50"
                          />
                        )}
                        <Play
                          className="relative h-3 w-3 text-white ml-0.5"
                          fill="currentColor"
                        />
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ) : undefined
        }
      />
      <VideoPlayerDialog
        videoUrl={playingUrl}
        open={playerOpen}
        onOpenChange={setPlayerOpen}
      />
    </>
  )
}
