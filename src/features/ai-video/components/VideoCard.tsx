import { useState } from 'react'
import { ImageIcon, ImageOff, MoreHorizontal, Play, Trash2 } from 'lucide-react'
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
  /**
   * Called after the user picks a frame in the thumbnail picker dialog.
   * Receives the capturing video and a JPEG data URL. Expected to upload
   * it and update the row's thumbnail_path.
   */
  onCaptureFrame?: (video: SavedAiVideo, imageBase64: string) => Promise<void>
  onRemoveThumb?: (video: SavedAiVideo) => void
}

function getVideoUrl(video: SavedAiVideo): string | null {
  return video.generation_metadata?.fal_url ?? null
}

function getPromptText(video: SavedAiVideo): string | null {
  const meta = video.generation_metadata
  if (!meta) return null
  // FLF: transition prompt. Multishot: concatenate shot prompts.
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
  onCaptureFrame,
  onRemoveThumb,
}: VideoCardProps) {
  const [playerOpen, setPlayerOpen] = useState(false)
  const [playingUrl, setPlayingUrl] = useState<string | null>(null)
  const [framePickerOpen, setFramePickerOpen] = useState(false)

  const childCount = children?.length ?? 0
  const videoUrl = getVideoUrl(video)
  const isPending = video.status === 'pending' || video.status === 'processing'
  const thumbnailStatus = isPending
    ? 'pending'
    : video.status === 'failed'
      ? 'failed'
      : 'complete'

  const promptText = getPromptText(video)

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
        objectFit="contain"
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
          onDelete || onCaptureFrame || onRemoveThumb ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <ExpandableIconButton
                  icon={<MoreHorizontal className="h-3.5 w-3.5" />}
                  label="More actions"
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                onClick={(e) => e.stopPropagation()}
              >
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
                {onDelete && (
                  <DropdownMenuItem
                    onClick={() => onDelete(video)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
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
            <ExpandableText
              text={promptText ?? video.title}
              className="px-3 pt-2 pb-3"
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
