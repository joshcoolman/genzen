import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface VideoFramePickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  videoUrl: string | null
  /** Called with a JPEG data URL of the captured frame. */
  onCapture: (imageBase64: string) => Promise<void> | void
}

/**
 * Route the video through our Nitro proxy so canvas.toDataURL() works.
 * FAL's CDN doesn't send the CORS headers a cross-origin canvas read needs.
 */
function buildProxiedUrl(videoUrl: string | null): string | null {
  if (!videoUrl) return null
  if (videoUrl.startsWith('data:') || videoUrl.startsWith('blob:')) {
    return videoUrl
  }
  return `/api/video-proxy?url=${encodeURIComponent(videoUrl)}`
}

/**
 * Scrub-only video frame picker. Shows the video with native seek controls
 * but no autoplay. User scrubs to the frame they want, clicks "Use this
 * frame", and we capture the current frame via canvas.
 *
 * CORS note: the video element uses crossOrigin="anonymous" so the canvas
 * doesn't become tainted on toDataURL(). Requires the FAL CDN to send
 * Access-Control-Allow-Origin on video responses. If it doesn't, the button
 * surfaces a clear error state.
 */
export function VideoFramePickerDialog({
  open,
  onOpenChange,
  videoUrl,
  onCapture,
}: VideoFramePickerDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [capturing, setCapturing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Route the video through our CORS-enabled proxy so canvas reads work
  const proxiedUrl = useMemo(() => buildProxiedUrl(videoUrl), [videoUrl])

  // Reset transient state when the dialog opens/closes
  useEffect(() => {
    if (open) {
      setError(null)
      setCapturing(false)
    }
  }, [open])

  const handleCapture = useCallback(async () => {
    const video = videoRef.current
    if (!video) return

    setCapturing(true)
    setError(null)

    try {
      // Draw the current frame to a canvas
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas 2D context unavailable')
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      // toDataURL throws SecurityError if the canvas was tainted by a
      // cross-origin video without CORS headers. Catch and surface clearly.
      let dataUrl: string
      try {
        dataUrl = canvas.toDataURL('image/jpeg', 0.85)
      } catch {
        throw new Error(
          "Can't capture frame: video CDN doesn't allow cross-origin reads.",
        )
      }

      await onCapture(dataUrl)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to capture frame')
    } finally {
      setCapturing(false)
    }
  }, [onCapture, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-4">
        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-medium">Generate thumb</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Scrub to the frame you want, then click "Use this frame".
            </p>
          </div>
          {proxiedUrl ? (
            <video
              key={proxiedUrl}
              ref={videoRef}
              src={proxiedUrl}
              crossOrigin="anonymous"
              controls
              preload="metadata"
              playsInline
              className="w-full rounded-md bg-black aspect-video"
            />
          ) : (
            <div className="w-full aspect-video rounded-md bg-muted/30 flex items-center justify-center">
              <span className="text-xs text-muted-foreground">
                No video available
              </span>
            </div>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={capturing}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleCapture()}
              disabled={!proxiedUrl || capturing}
            >
              {capturing ? 'Capturing...' : 'Use this frame'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
