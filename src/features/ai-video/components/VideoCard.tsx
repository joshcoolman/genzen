import { useState } from 'react'
import {
  ArrowUpRight,
  CheckCircle2,
  Circle,
  Download,
  ImageIcon,
  ImageOff,
  MoreHorizontal,
  Play,
  Trash2,
  Unlink,
} from 'lucide-react'
import { getVideoModelName } from '../video-models'
import { VideoFramePickerDialog } from './VideoFramePickerDialog'
import type { SavedAiVideo } from '../video-types'
import { Thumbnail } from '@/components/Thumbnail'
import { ExpandableText } from '@/components/ExpandableText'
import { ExpandableIconButton } from '@/components/ExpandableIconButton'
import { VideoPlayerDialog } from '@/components/video-player-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

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
  onStartAdopt?: (video: SavedAiVideo) => void
  onUnlink?: (video: SavedAiVideo) => void
  onUngroup?: (video: SavedAiVideo) => void
  onDownload?: (video: SavedAiVideo) => void
  onCaptureFrame?: (video: SavedAiVideo, imageBase64: string) => Promise<void>
  onRemoveThumb?: (video: SavedAiVideo) => void
}

function getVideoUrl(video: SavedAiVideo): string | null {
  return video.generation_metadata?.fal_url ?? null
}

function getPromptText(video: SavedAiVideo): string | null {
  const meta = video.generation_metadata
  if (!meta) return null
  const flfPrompt =
    (meta as { transition_prompt?: string }).transition_prompt ??
    (meta as { prompt?: string }).prompt
  if (flfPrompt) return flfPrompt
  const shots = (meta as { shots?: Array<{ prompt?: string }> }).shots
  if (shots && shots.length > 0) {
    return shots
      .map((s) => s.prompt)
      .filter(Boolean)
      .join(' · ')
  }
  return null
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
  onStartAdopt,
  onUnlink,
  onUngroup,
  onDownload,
  onCaptureFrame,
  onRemoveThumb,
}: VideoCardProps) {
  const [playerOpen, setPlayerOpen] = useState(false)
  const [playingUrl, setPlayingUrl] = useState<string | null>(null)
  const [framePickerOpen, setFramePickerOpen] = useState(false)

  const childCount = children?.length ?? 0
  const hasChildren = childCount > 0
  const hasParent = typeof video.generation_metadata?.parent_id === 'string'
  const videoUrl = getVideoUrl(video)
  const isPending = video.status === 'pending' || video.status === 'processing'
  const thumbnailStatus = isPending
    ? 'pending'
    : video.status === 'failed'
      ? 'failed'
      : 'complete'

  const promptText = getPromptText(video)
  const modelId = (video.generation_metadata as { model?: string } | null)
    ?.model
  const displayTitle = modelId ? getVideoModelName(modelId) : 'AI Video'

  const handleClick = () => {
    if (selectionActive && onSelect) return
    onOpen?.(video)
  }

  const handlePlay = (url: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setPlayingUrl(url)
    setPlayerOpen(true)
  }

  const moreButton = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ExpandableIconButton
          icon={<MoreHorizontal className="h-3.5 w-3.5" />}
          label="More actions"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
        {onCaptureFrame && videoUrl && !isPending && (
          <DropdownMenuItem onClick={() => setFramePickerOpen(true)}>
            <ImageIcon className="h-4 w-4" />
            Generate Thumb
          </DropdownMenuItem>
        )}
        {onRemoveThumb && video.thumbnail_path && (
          <DropdownMenuItem onClick={() => onRemoveThumb(video)}>
            <ImageOff className="h-4 w-4" />
            Remove Thumb
          </DropdownMenuItem>
        )}
        {onDownload && videoUrl && !isPending && (
          <DropdownMenuItem onClick={() => onDownload(video)}>
            <Download className="h-4 w-4" />
            Download
          </DropdownMenuItem>
        )}
        {onStartAdopt && !hasChildren && (
          <DropdownMenuItem onClick={() => onStartAdopt(video)}>
            <ArrowUpRight className="h-4 w-4" />
            Move
          </DropdownMenuItem>
        )}
        {hasChildren && onUngroup && (
          <DropdownMenuItem onClick={() => onUngroup(video)}>
            <Unlink className="h-4 w-4" />
            Ungroup
          </DropdownMenuItem>
        )}
        {hasParent && onUnlink && (
          <DropdownMenuItem onClick={() => onUnlink(video)}>
            <Unlink className="h-4 w-4" />
            Unlink
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const deleteButton = onDelete ? (
    <ExpandableIconButton
      icon={<Trash2 className="h-3.5 w-3.5" />}
      label="Delete"
      variant="destructive"
      onClick={() => onDelete(video)}
    />
  ) : undefined

  return (
    <>
      <Thumbnail
        url={thumbnailUrl}
        objectFit="contain"
        status={thumbnailStatus}
        pendingLabel="Processing..."
        pendingBackgroundUrl={thumbnailUrl ?? undefined}
        alwaysShowOverlay
        selected={selected || (active && !selectionActive)}
        selectedClassName={
          active && !selectionActive
            ? 'border-primary ring-2 ring-primary shadow-lg shadow-primary/20'
            : 'border-accent-brand ring-1 ring-accent-brand'
        }
        onClick={handleClick}
        topLeftBadge={
          childCount > 0
            ? `${childCount + 1} ${childCount + 1 === 1 ? 'video' : 'videos'}`
            : undefined
        }
        overlayActionsLeft={selectionActive ? undefined : moreButton}
        overlayActions={selectionActive ? undefined : deleteButton}
        overlayActionsBottomLeft={
          onSelect ? (
            <ExpandableIconButton
              icon={
                selected ? (
                  <CheckCircle2 className="h-4 w-4 text-accent-brand" />
                ) : (
                  <Circle className="h-4 w-4" />
                )
              }
              label={selected ? 'Deselect' : 'Select'}
              onClick={(e) => onSelect(video.id, e.shiftKey)}
            />
          ) : undefined
        }
        overlayActionsBottomRight={
          videoUrl && !isPending && !selectionActive ? (
            <ExpandableIconButton
              icon={<Play className="h-3.5 w-3.5" fill="currentColor" />}
              label="Play"
              onClick={(e) => handlePlay(videoUrl, e)}
            />
          ) : undefined
        }
        imageOverlay={
          selectionActive && onSelect ? (
            <div
              className="absolute inset-0 z-10 cursor-pointer select-none"
              onClick={(e) => {
                e.stopPropagation()
                onSelect(video.id, e.shiftKey)
              }}
            />
          ) : undefined
        }
      >
        {showInfo && (
          <>
            <p className="truncate px-3 pt-2 text-xs font-medium text-foreground">
              {displayTitle}
            </p>
            <ExpandableText
              text={promptText ?? video.title}
              className="px-3 pt-0.5 pb-3"
              textClassName="text-xs text-muted-foreground"
            />
            {childCount > 0 && children && (
              <div className="px-1.5 pb-1.5">
                <div className="flex flex-wrap gap-1">
                  {children.slice(0, 6).map((c) => {
                    const cvUrl = getVideoUrl(c.video)
                    return (
                      <button
                        key={c.video.id}
                        onClick={(e) => {
                          if (cvUrl) {
                            handlePlay(cvUrl, e)
                          } else {
                            e.stopPropagation()
                          }
                        }}
                        className="relative w-10 h-10 rounded bg-black flex items-center justify-center border border-border hover:border-foreground/30 transition-colors overflow-hidden"
                      >
                        {c.thumbnailUrl && (
                          <img
                            src={c.thumbnailUrl}
                            alt=""
                            className="absolute inset-0 w-full h-full object-cover opacity-70"
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
              </div>
            )}
          </>
        )}
      </Thumbnail>
      <VideoPlayerDialog
        videoUrl={playingUrl}
        open={playerOpen}
        onOpenChange={setPlayerOpen}
      />
      {onCaptureFrame && (
        <VideoFramePickerDialog
          open={framePickerOpen}
          onOpenChange={setFramePickerOpen}
          videoUrl={videoUrl}
          onCapture={async (imageBase64) => {
            await onCaptureFrame(video, imageBase64)
          }}
        />
      )}
    </>
  )
}
