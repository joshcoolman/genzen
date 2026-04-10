import { useState } from 'react'
import { ArrowLeft, Play, Trash2  } from 'lucide-react'
import type { Generation } from '../types'
import { Thumbnail } from '@/components/Thumbnail'
import { VideoPlayerDialog } from '@/components/video-player-dialog'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { ExpandableIconButton } from '@/components/ExpandableIconButton'
import { cn } from '@/lib/utils'

interface GenerationChainProps {
  generations: Array<Generation>
  firstFrameUrl: string | null
  onBack: () => void
  onLoad: (gen: Generation) => void
  onContinue: (gen: Generation) => void
  onDelete: (id: string) => void
  onGenerateVideo?: (gen: Generation) => void
  accessToken: string | undefined
}

export function GenerationChain({
  generations,
  firstFrameUrl,
  onBack,
  onLoad,
  onContinue,
  onDelete,
  onGenerateVideo,
}: GenerationChainProps) {
  const [videoOpen, setVideoOpen] = useState(false)
  const [playingUrl, setPlayingUrl] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [selectedGenId, setSelectedGenId] = useState<string | null>(null)

  const selectedGen = selectedGenId
    ? generations.find((g) => g.id === selectedGenId)
    : null

  return (
    <div className="space-y-4">
      {/* Back nav */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3 w-3" />
        All generations
      </button>

      {/* Parent card: first frame as prominent thumbnail */}
      <Thumbnail
        url={firstFrameUrl}
        objectFit="cover"
        className="max-w-xs"
        footer={
          <div className="px-3 py-2 space-y-2">
            <span className="text-[10px] text-muted-foreground">
              {generations.length}{' '}
              {generations.length === 1 ? 'video' : 'videos'}
            </span>

            {/* Child thumbnails: each video generation */}
            {generations.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {generations.map((gen) => {
                  const hasVideo =
                    gen.video?.status === 'completed' && gen.video.url
                  const isPending =
                    gen.video?.status === 'pending' ||
                    gen.lastFrame?.status === 'pending'
                  const isFailed = gen.video?.status === 'failed'
                  const isSelected = gen.id === selectedGenId

                  return (
                    <button
                      key={gen.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (hasVideo) {
                          setSelectedGenId(gen.id)
                          onLoad(gen)
                        } else if (isPending) {
                          setSelectedGenId(gen.id)
                        }
                      }}
                      className={cn(
                        'relative w-14 h-14 rounded overflow-hidden border transition-colors',
                        isSelected
                          ? 'border-accent-brand ring-1 ring-accent-brand'
                          : 'border-border hover:border-foreground/30',
                      )}
                    >
                      {/* Background: first frame image dimmed */}
                      {gen.firstFrame?.url && (
                        <img
                          src={gen.firstFrame.url}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover opacity-40"
                        />
                      )}

                      {/* Status overlay */}
                      {isPending ? (
                        <div className="relative flex items-center justify-center h-full">
                          <div className="size-4 animate-spin rounded-full border-2 border-border border-t-accent-brand" />
                        </div>
                      ) : hasVideo ? (
                        <div className="relative flex items-center justify-center h-full">
                          <Play
                            className="h-4 w-4 text-white drop-shadow-md ml-0.5"
                            fill="currentColor"
                          />
                        </div>
                      ) : isFailed ? (
                        <div className="relative flex items-center justify-center h-full">
                          <span className="text-[9px] text-destructive">
                            Failed
                          </span>
                        </div>
                      ) : (
                        <div className="relative flex items-center justify-center h-full">
                          <span className="text-[9px] text-muted-foreground">
                            No video
                          </span>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        }
      />

      {/* Selected generation detail */}
      {selectedGen && (
        <div className="rounded-lg border border-border bg-sidebar p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {new Date(selectedGen.createdAt).toLocaleString()}
            </span>
            <div className="flex items-center gap-1">
              {selectedGen.video?.status === 'completed' &&
                selectedGen.video.url && (
                  <button
                    onClick={() => {
                      setPlayingUrl(selectedGen.video!.url)
                      setVideoOpen(true)
                    }}
                    className="flex items-center gap-1 text-xs text-accent-brand hover:text-accent-brand/80 transition-colors"
                  >
                    <Play className="h-3 w-3" fill="currentColor" />
                    Play
                  </button>
                )}
              <button
                onClick={() => onContinue(selectedGen)}
                disabled={
                  !selectedGen.lastFrame?.url ||
                  selectedGen.lastFrame.status === 'pending'
                }
                className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
              >
                Continue
              </button>
              <ExpandableIconButton
                icon={<Trash2 className="h-3 w-3" />}
                label="Delete"
                variant="destructive"
                onClick={() => setDeleteConfirmId(selectedGen.id)}
              />
            </div>
          </div>

          {/* Frame thumbnails */}
          <div className="flex gap-2">
            {selectedGen.lastFrame?.url && (
              <div className="space-y-1">
                <span className="text-[9px] text-muted-foreground">
                  Last frame
                </span>
                <img
                  src={selectedGen.lastFrame.url}
                  alt="Last frame"
                  className="w-24 aspect-video rounded object-cover border border-border"
                />
              </div>
            )}
            {selectedGen.video?.status === 'completed' &&
              selectedGen.video.url && (
                <div className="space-y-1">
                  <span className="text-[9px] text-muted-foreground">
                    Video
                  </span>
                  <button
                    onClick={() => {
                      setPlayingUrl(selectedGen.video!.url)
                      setVideoOpen(true)
                    }}
                    className="w-24 aspect-video rounded bg-black flex items-center justify-center border border-border hover:border-foreground/30 transition-colors"
                  >
                    <Play
                      className="h-5 w-5 text-white ml-0.5"
                      fill="currentColor"
                    />
                  </button>
                </div>
              )}
          </div>
        </div>
      )}

      {/* Generate video prompt for generations without video */}
      {onGenerateVideo &&
        generations.some(
          (g) =>
            !g.video &&
            (g.lastFrame?.status === 'completed' ||
              (g.lastFrame?.url && g.lastFrame.status !== 'pending')),
        ) && (
          <div className="flex gap-2">
            {generations
              .filter(
                (g) =>
                  !g.video &&
                  (g.lastFrame?.status === 'completed' ||
                    (g.lastFrame?.url && g.lastFrame.status !== 'pending')),
              )
              .map((gen) => (
                <button
                  key={gen.id}
                  onClick={() => onGenerateVideo(gen)}
                  className="text-xs text-accent-brand hover:text-accent-brand/80 transition-colors border border-dashed border-accent-brand/30 rounded px-3 py-1.5"
                >
                  Generate video
                </button>
              ))}
          </div>
        )}

      <VideoPlayerDialog
        videoUrl={playingUrl}
        open={videoOpen}
        onOpenChange={setVideoOpen}
      />

      <ConfirmDialog
        open={deleteConfirmId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirmId(null)
        }}
        title="Delete this generation?"
        description="This will permanently delete this generation and its frames. This cannot be undone."
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={() => {
          if (!deleteConfirmId) return
          setDeleting(true)
          try {
            onDelete(deleteConfirmId)
            if (selectedGenId === deleteConfirmId) setSelectedGenId(null)
          } finally {
            setDeleting(false)
            setDeleteConfirmId(null)
          }
        }}
      />
    </div>
  )
}
