import { useEffect, useRef, useState } from 'react'
import type { Generation } from '../types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { checkPendingVideo } from '@/features/ai-video/server/check-pending-video.server'
import { checkPendingImages } from '@/features/ai-images/server/check-pending-images.server'
import { deleteGeneration } from '@/features/ai-video/server/delete-generation.server'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

export function GenerationRow({
  generation,
  selected,
  onToggleSelect,
  onLoad,
  onContinue,
  onUpdate,
  onDelete,
  onGenerateVideo,
  onLastFrameCompleted,
  accessToken,
}: {
  generation: Generation
  selected: boolean
  onToggleSelect: (id: string) => void
  onLoad: (gen: Generation) => void
  onContinue: (gen: Generation) => void
  onUpdate: (id: string, updates: Partial<Generation>) => void
  onDelete: (id: string) => void
  onGenerateVideo?: (gen: Generation) => void
  onLastFrameCompleted?: (gen: Generation) => void
  accessToken: string | undefined
}) {
  const [videoOpen, setVideoOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [generatingVideo, setGeneratingVideo] = useState(false)
  const videoPollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastFramePollingRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  )
  const autoVideoTriggeredRef = useRef(false)

  const isVideoPending = generation.video?.status === 'pending'
  const isLastFramePending = generation.lastFrame?.status === 'pending'
  const lastFrameCompleted =
    generation.lastFrame?.status === 'completed' ||
    (generation.lastFrame?.url && generation.lastFrame.status !== 'pending')

  // Video polling
  useEffect(() => {
    if (!isVideoPending || !accessToken || !generation.video) return

    const videoRecordId = generation.video.id

    const poll = async () => {
      try {
        const result = await checkPendingVideo({
          data: { accessToken, recordId: videoRecordId },
        })
        if (result.status === 'completed' && result.videoUrl) {
          onUpdate(generation.id, {
            video: {
              id: videoRecordId,
              url: result.videoUrl,
              status: 'completed',
            },
          })
        } else if (result.status === 'error') {
          onUpdate(generation.id, {
            video: { id: videoRecordId, url: null, status: 'failed' },
          })
        }
      } catch {
        // keep polling
      }
    }

    poll()
    videoPollingRef.current = setInterval(poll, 5000)
    return () => {
      if (videoPollingRef.current) clearInterval(videoPollingRef.current)
    }
  }, [
    isVideoPending,
    accessToken,
    generation.video?.id,
    generation.id,
    onUpdate,
  ])

  // Last frame polling
  useEffect(() => {
    if (!isLastFramePending || !accessToken || !generation.lastFrame) return

    const lastFrameRecordId = generation.lastFrame.id

    const poll = async () => {
      try {
        await checkPendingImages({
          data: { accessToken, recordIds: [lastFrameRecordId] },
        })
        const { data: recordData } = await supabase
          .from('user_images')
          .select('status, storage_path')
          .eq('id', lastFrameRecordId)
          .single()
        const record = recordData as {
          status: string
          storage_path: string | null
        } | null
        if (record?.status === 'completed' && record.storage_path) {
          const { data: urlData } = await supabase.storage
            .from('user-images')
            .createSignedUrl(record.storage_path, 3600)
          if (urlData) {
            const completedLastFrame = {
              id: lastFrameRecordId,
              url: urlData.signedUrl,
              status: 'completed' as const,
            }
            onUpdate(generation.id, { lastFrame: completedLastFrame })

            const updatedGen: Generation = {
              ...generation,
              lastFrame: completedLastFrame,
            }
            onLastFrameCompleted?.(updatedGen)

            if (
              onGenerateVideo &&
              !generation.video &&
              !autoVideoTriggeredRef.current
            ) {
              autoVideoTriggeredRef.current = true
              onGenerateVideo(updatedGen)
            }
          }
        } else if (record?.status === 'failed') {
          onUpdate(generation.id, {
            lastFrame: {
              id: lastFrameRecordId,
              url: null,
              status: 'failed',
            },
          })
        }
      } catch {
        // keep polling
      }
    }

    poll()
    lastFramePollingRef.current = setInterval(poll, 3000)
    return () => {
      if (lastFramePollingRef.current)
        clearInterval(lastFramePollingRef.current)
    }
  }, [
    isLastFramePending,
    accessToken,
    generation.lastFrame?.id,
    generation.id,
    generation.video,
    onUpdate,
    onGenerateVideo,
    onLastFrameCompleted,
  ])

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border transition-colors',
        selected
          ? 'border-accent-gold bg-accent-gold/5'
          : 'border-border hover:bg-muted/30',
      )}
    >
      {/* Select checkbox */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onToggleSelect(generation.id)
        }}
        className={cn(
          'shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors',
          selected
            ? 'border-accent-gold bg-accent-gold text-black'
            : 'border-border hover:border-foreground/50',
        )}
      >
        {selected && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M2.5 6L5 8.5L9.5 3.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      {/* Thumbnails */}
      <div className="flex gap-2 shrink-0">
        {generation.firstFrame?.url ? (
          <img
            src={generation.firstFrame.url}
            alt="First frame"
            className="w-24 aspect-video rounded object-cover border border-border"
          />
        ) : (
          <div className="w-24 aspect-video rounded border border-dashed border-border bg-muted/30" />
        )}

        {/* Last frame thumbnail */}
        {isLastFramePending ? (
          <div className="w-24 aspect-video rounded border border-border bg-muted/30 flex items-center justify-center animate-pulse">
            <p className="text-[10px] text-muted-foreground">Generating...</p>
          </div>
        ) : generation.lastFrame?.url ? (
          <img
            src={generation.lastFrame.url}
            alt="Last frame"
            className="w-24 aspect-video rounded object-cover border border-border"
          />
        ) : generation.lastFrame?.status === 'failed' ? (
          <div className="w-24 aspect-video rounded border border-destructive/50 bg-destructive/10 flex items-center justify-center">
            <p className="text-[10px] text-destructive">Failed</p>
          </div>
        ) : (
          <div className="w-24 aspect-video rounded border border-dashed border-border bg-muted/30" />
        )}

        {/* Video thumbnail */}
        {generation.video?.status === 'pending' ? (
          <div className="w-24 aspect-video rounded border border-border bg-muted/30 flex items-center justify-center animate-pulse">
            <p className="text-[10px] text-muted-foreground">Processing...</p>
          </div>
        ) : generation.video?.url ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setVideoOpen(true)
            }}
            className="relative group"
          >
            <video
              src={generation.video.url}
              className="w-24 aspect-video rounded object-cover border border-border"
              muted
              preload="metadata"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-white text-xs">Play</span>
            </div>
          </button>
        ) : generation.video?.status === 'failed' ? (
          <div className="w-24 aspect-video rounded border border-destructive/50 bg-destructive/10 flex items-center justify-center">
            <p className="text-[10px] text-destructive">Failed</p>
          </div>
        ) : !generation.video && lastFrameCompleted && onGenerateVideo ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setGeneratingVideo(true)
              onGenerateVideo(generation)
            }}
            disabled={generatingVideo}
            className="w-24 aspect-video rounded border border-dashed border-accent-gold/50 bg-accent-gold/5 flex items-center justify-center hover:bg-accent-gold/10 transition-colors"
          >
            <p className="text-[10px] text-accent-gold font-medium">
              {generatingVideo ? 'Starting...' : 'Gen Video'}
            </p>
          </button>
        ) : (
          <div className="w-24 aspect-video rounded border border-dashed border-border bg-muted/30" />
        )}
      </div>

      {/* Date + load/delete buttons */}
      <div className="flex flex-1 items-center justify-between min-w-0">
        <span className="text-xs text-muted-foreground">
          {new Date(generation.createdAt).toLocaleString()}
        </span>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            disabled={!lastFrameCompleted || !generation.lastFrame?.url}
            onClick={() => onContinue(generation)}
          >
            Continue
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => onLoad(generation)}
          >
            Load
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-destructive"
            disabled={deleting}
            onClick={async () => {
              if (!accessToken) return
              if (!window.confirm('Delete this generation?')) return
              setDeleting(true)
              try {
                await deleteGeneration({
                  data: {
                    generationId: generation.id,
                    accessToken,
                  },
                })
                onDelete(generation.id)
              } catch {
                setDeleting(false)
              }
            }}
          >
            {deleting ? '...' : 'Delete'}
          </Button>
        </div>
      </div>

      {/* Video dialog */}
      <Dialog open={videoOpen} onOpenChange={setVideoOpen}>
        <DialogContent className="max-w-3xl p-2 data-[state=open]:!animate-in data-[state=open]:!fade-in-0 data-[state=open]:!zoom-in-95 data-[state=open]:!slide-in-from-left-0 data-[state=open]:!slide-in-from-top-0 data-[state=closed]:!animate-out data-[state=closed]:!fade-out-0 data-[state=closed]:!zoom-out-95 data-[state=closed]:!slide-out-to-left-0 data-[state=closed]:!slide-out-to-top-0">
          {generation.video?.url && (
            <video
              src={generation.video.url}
              controls
              autoPlay
              loop
              className="aspect-video w-full rounded bg-black"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
