import { useMemo } from 'react'
import type { SavedAiVideo } from '../video-types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ImageGrid } from '@/components/ImageGrid'
import { Thumbnail } from '@/components/Thumbnail'

interface VideoParentPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  movingVideo: SavedAiVideo
  movingVideoUrl: string | undefined
  /** When set (length > 1), triggers batch-move label. */
  movingVideos?: Array<SavedAiVideo>
  videos: Array<SavedAiVideo>
  thumbnailUrls: Record<string, string>
  loading: boolean
  onConfirm: (newParentId: string) => void
}

export function VideoParentPickerDialog({
  open,
  onOpenChange,
  movingVideo,
  movingVideoUrl,
  movingVideos,
  videos,
  thumbnailUrls,
  loading,
  onConfirm,
}: VideoParentPickerDialogProps) {
  const isBatch = movingVideos && movingVideos.length > 1

  const excludedIds = useMemo(() => {
    const sourceIds = movingVideos
      ? movingVideos.map((v) => v.id)
      : [movingVideo.id]
    const excluded = new Set<string>(sourceIds)
    // Videos have a shallow parent_id model -- exclude any video whose
    // parent is in the moving set (direct children only; video groups
    // don't nest deeper than one level in practice).
    for (const v of videos) {
      const pid = v.generation_metadata?.parent_id
      if (pid && excluded.has(pid)) excluded.add(v.id)
    }
    return excluded
  }, [movingVideo.id, movingVideos, videos])

  const allChildIds = useMemo(() => {
    const s = new Set<string>()
    for (const v of videos) {
      const pid = v.generation_metadata?.parent_id
      if (pid) s.add(v.id)
    }
    return s
  }, [videos])

  const availableVideos = useMemo(
    () =>
      videos.filter(
        (v) =>
          v.status === 'completed' &&
          !excludedIds.has(v.id) &&
          !allChildIds.has(v.id),
      ),
    [videos, excludedIds, allChildIds],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Move under...</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-3 rounded-md border border-border bg-muted/50 p-3">
          {isBatch ? (
            <span className="text-sm text-muted-foreground">
              Select a new parent for {movingVideos.length} videos
            </span>
          ) : (
            <>
              {movingVideoUrl && (
                <img
                  src={movingVideoUrl}
                  alt=""
                  className="w-12 h-12 rounded object-cover"
                />
              )}
              <span className="text-sm text-muted-foreground">
                Select a new parent for this video
              </span>
            </>
          )}
        </div>

        {availableVideos.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No available videos to move under
          </p>
        ) : (
          <ImageGrid size="md">
            {availableVideos.map((v) => (
              <Thumbnail
                key={v.id}
                url={thumbnailUrls[v.id] ?? null}
                alt={v.title}
                status="complete"
                compact
                onClick={() => {
                  if (!loading) onConfirm(v.id)
                }}
              />
            ))}
          </ImageGrid>
        )}
      </DialogContent>
    </Dialog>
  )
}
