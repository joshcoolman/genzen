import { useState } from 'react'
import { Play, Trash2 } from 'lucide-react'
import type { FirstFrameGroup } from '../hooks/use-generations'
import type { Generation } from '../types'
import { Thumbnail } from '@/components/Thumbnail'
import { ExpandableIconButton } from '@/components/ExpandableIconButton'
import { VideoPlayerDialog } from '@/components/video-player-dialog'
import { cn } from '@/lib/utils'

interface VideoCardProps {
  group: FirstFrameGroup
  showInfo?: boolean
  active?: boolean
  selected?: boolean
  selectionActive?: boolean
  onActivate?: (firstFrameId: string) => void
  onSelect?: (firstFrameId: string, shiftKey: boolean) => void
  onDelete?: (generationIds: Array<string>) => void
}

function getLatestVideo(gens: Array<Generation>): Generation['video'] | null {
  for (const g of gens) {
    if (g.video) return g.video
  }
  return null
}

function getVideoStatus(
  gens: Array<Generation>,
): 'idle' | 'pending' | 'completed' | 'failed' {
  const hasCompleted = gens.some((g) => g.video?.status === 'completed')
  const hasPending = gens.some(
    (g) => g.video?.status === 'pending' || g.lastFrame?.status === 'pending',
  )
  const hasFailed = gens.some((g) => g.video?.status === 'failed')
  if (hasPending) return 'pending'
  if (hasCompleted) return 'completed'
  if (hasFailed) return 'failed'
  return 'idle'
}

export function VideoCard({
  group,
  showInfo = true,
  active = false,
  selected = false,
  selectionActive = false,
  onActivate,
  onSelect,
  onDelete,
}: VideoCardProps) {
  const [videoOpen, setVideoOpen] = useState(false)
  const [playingUrl, setPlayingUrl] = useState<string | null>(null)

  const { firstFrameId, firstFrameUrl, generations } = group
  const genCount = generations.length
  const status = getVideoStatus(generations)
  const latestVideo = getLatestVideo(generations)

  const completedVideos = generations.filter(
    (g) => g.video?.status === 'completed' && g.video.url,
  )

  const handleClick = (e?: React.MouseEvent) => {
    if (selectionActive && onSelect) {
      onSelect(firstFrameId, e?.shiftKey ?? false)
    } else {
      onActivate?.(firstFrameId)
    }
  }

  const handlePlayLatest = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (latestVideo?.url) {
      setPlayingUrl(latestVideo.url)
      setVideoOpen(true)
    }
  }

  const handlePlayChild = (url: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setPlayingUrl(url)
    setVideoOpen(true)
  }

  const thumbnailStatus = status === 'pending' ? 'pending' : 'complete'

  return (
    <>
      <Thumbnail
        url={firstFrameUrl}
        objectFit="cover"
        status={thumbnailStatus}
        pendingLabel="Processing..."
        pendingBackgroundUrl={firstFrameUrl ?? undefined}
        selected={selected || active}
        selectedClassName={
          active
            ? 'border-accent-brand ring-1 ring-accent-brand'
            : 'border-primary ring-1 ring-primary'
        }
        onClick={handleClick}
        topLeftBadge={genCount > 1 ? `${genCount} videos` : undefined}
        overlayActions={
          onDelete ? (
            <ExpandableIconButton
              icon={<Trash2 className="h-3.5 w-3.5" />}
              label="Delete"
              variant="destructive"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(generations.map((g) => g.id))
              }}
            />
          ) : undefined
        }
        overlayActionsBottomRight={
          latestVideo?.status === 'completed' && latestVideo.url ? (
            <button
              onClick={handlePlayLatest}
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
                  {new Date(group.latestDate).toLocaleDateString()}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {genCount} {genCount === 1 ? 'gen' : 'gens'}
                </span>
              </div>
              {completedVideos.length > 0 && (
                <div className="flex gap-1">
                  {completedVideos.slice(0, 4).map((gen) => (
                    <button
                      key={gen.id}
                      onClick={(e) => handlePlayChild(gen.video!.url!, e)}
                      className={cn(
                        'relative w-10 h-10 rounded bg-black flex items-center justify-center group/child',
                        'border border-border hover:border-foreground/30 transition-colors',
                      )}
                    >
                      {gen.firstFrame?.url && (
                        <img
                          src={gen.firstFrame.url}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover rounded opacity-50"
                        />
                      )}
                      <Play
                        className="relative h-3 w-3 text-white ml-0.5"
                        fill="currentColor"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : undefined
        }
      />
      <VideoPlayerDialog
        videoUrl={playingUrl}
        open={videoOpen}
        onOpenChange={setVideoOpen}
      />
    </>
  )
}
