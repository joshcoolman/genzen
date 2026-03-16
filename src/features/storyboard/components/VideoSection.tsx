import { Loader2, Play, Video } from 'lucide-react'
import type { UseStoryboardReturn } from '../hooks/useStoryboard'
import { ActionButton } from '@/components/ActionButton'

const DURATION_OPTIONS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]

interface VideoSectionProps {
  sb: UseStoryboardReturn
}

export function VideoSection({ sb }: VideoSectionProps) {
  const totalDuration = sb.scenes.reduce(
    (sum, s) => sum + s.duration_seconds,
    0,
  )
  const sceneCount = sb.scenes.length
  const missingFrames = sceneCount - sb.scenes.filter((s) => s.image_id).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Video className="size-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Video</h2>
        </div>
        <span className="text-sm text-muted-foreground">
          {sb.clips.length} clip{sb.clips.length !== 1 ? 's' : ''}, ~
          {totalDuration}s total
        </span>
      </div>

      {!sb.allFramesReady && missingFrames > 0 && (
        <p className="text-sm text-muted-foreground">
          {missingFrames} scene{missingFrames > 1 ? 's' : ''} still need frames
          before generating video.
        </p>
      )}

      {/* Clip groups */}
      {sb.allFramesReady && (
        <div className="space-y-3">
          {sb.clips.map((clip, clipIdx) => {
            const clipUrl = sb.videoClipUrls[clipIdx]
            const isSubmitting = sb.generatingClipIndices.has(clipIdx)
            // Clip has been submitted but video not yet ready
            const isPending =
              !clipUrl && !isSubmitting && clipIdx < sb.videoClipIds.length
            const isBusy = isSubmitting || isPending

            return (
              <div
                key={clipIdx}
                className={`rounded-lg border overflow-hidden transition-colors ${
                  isBusy
                    ? 'border-accent-brand/40 bg-accent-brand/5'
                    : 'border-border'
                }`}
              >
                {/* Clip header */}
                <div className="flex items-center justify-between bg-muted/50 px-3 py-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Clip {clipIdx + 1} -- {clip.scenes.length} shot
                    {clip.scenes.length !== 1 ? 's' : ''}, {clip.totalDuration}s
                  </span>
                  {!clipUrl && !isBusy && (
                    <ActionButton
                      onClick={() => sb.generateClip(clipIdx)}
                      icon={<Play className="size-3" />}
                      className="h-7 px-2.5 text-xs"
                    >
                      Generate
                    </ActionButton>
                  )}
                  {isBusy && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="size-3 animate-spin" />
                      {isSubmitting ? 'Submitting...' : 'Rendering video...'}
                    </span>
                  )}
                  {clipUrl && !isBusy && (
                    <ActionButton
                      onClick={() => sb.generateClip(clipIdx)}
                      icon={<Play className="size-3" />}
                      className="h-7 px-2.5 text-xs"
                    >
                      Regenerate
                    </ActionButton>
                  )}
                </div>

                {/* Shot list */}
                <div
                  className={`divide-y divide-border ${isBusy ? 'opacity-60 pointer-events-none' : ''}`}
                >
                  {clip.scenes.map((scene) => (
                    <div
                      key={scene.id}
                      className="flex items-center gap-3 px-3 py-1.5"
                    >
                      <span className="w-5 shrink-0 text-xs text-muted-foreground text-right">
                        {scene.scene_number}
                      </span>
                      {scene.image_url && (
                        <img
                          src={scene.image_url}
                          alt=""
                          className="size-7 shrink-0 rounded object-cover"
                        />
                      )}
                      <p className="flex-1 text-xs text-foreground/80 line-clamp-1">
                        {scene.visual_description}
                      </p>
                      <select
                        value={scene.duration_seconds}
                        onChange={(e) =>
                          sb.updateScene(scene.id, {
                            duration_seconds: parseInt(e.target.value, 10),
                          })
                        }
                        disabled={isBusy}
                        className="h-6 w-14 shrink-0 rounded border bg-background px-1 text-xs disabled:opacity-50"
                      >
                        {DURATION_OPTIONS.map((d) => (
                          <option key={d} value={d}>
                            {d}s
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                {/* Video player for completed clip */}
                {clipUrl && (
                  <video
                    src={clipUrl}
                    controls
                    className="aspect-video w-full bg-black"
                  />
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Generate All button */}
      {sb.allFramesReady && sb.clips.length > 1 && (
        <ActionButton
          onClick={sb.generateAllClips}
          disabled={sb.isGeneratingVideo}
          loading={sb.isGeneratingVideo}
          loadingText="Generating clips..."
          icon={<Play className="size-4" />}
          className="w-full"
        >
          Generate All Clips ({sb.clips.length})
        </ActionButton>
      )}

      {sb.videoError && (
        <p className="text-sm text-destructive">{sb.videoError}</p>
      )}
    </div>
  )
}
