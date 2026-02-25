import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { generateFirstFrame } from '@/features/ai-video/server/generate-first-frame.server'
import { generateLastFrame } from '@/features/ai-video/server/generate-last-frame.server'
import { generateFlfVideo } from '@/features/ai-video/server/generate-flf-video.server'
import { suggestLastFrame } from '@/features/ai-video/server/suggest-last-frame.server'
import { checkPendingImages } from '@/features/ai-images/server/check-pending-images.server'
import { checkPendingVideo } from '@/features/ai-video/server/check-pending-video.server'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

const DEFAULT_FIRST_FRAME_PROMPT =
  'A visceral side-mounted camera angle hugging just above the wheel arch of a red-and-white 1980s Formula 1 car blasting out of the Monaco tunnel into blinding Mediterranean sunlight. Tire sidewalls ripple with speed, polished livery shimmers, chrome suspension arms catch the light. Vintage 35mm racing documentary aesthetic, natural motion blur, golden hour.'

const DEFAULT_LAST_FRAME_PROMPT =
  'The same red-and-white 1980s Formula 1 car cresting the hill at Casino Square, rear wing slicing through hot air, the Monte Carlo harbor blazing in the distance below. Camera drifts wide as the car exits the frame right, crowd barriers streaking past in a blur. Lens flare across the bodywork, cinematic 35mm grain, shallow bokeh pulling focus to the exhaust.'

export const Route = createFileRoute('/dashboard/video')({
  component: VideoPage,
})

const FIRST_FRAME_MODELS = [
  { id: 'fal-ai/flux-pro/kontext', label: 'FLUX Kontext Pro' },
  { id: 'fal-ai/kling-image/o3/text-to-image', label: 'Kling Image O3' },
]

type FrameStatus = 'idle' | 'generating' | 'completed' | 'error'
type VideoStatus = 'idle' | 'generating' | 'completed' | 'error'

function FrameImageArea({
  status,
  imageUrl,
  placeholder,
}: {
  status: FrameStatus
  imageUrl: string | null
  placeholder: string
}) {
  if (status === 'idle') {
    return (
      <div className="aspect-video w-full rounded-md border border-dashed border-border bg-muted/30 flex items-center justify-center">
        <p className="text-xs text-muted-foreground">{placeholder}</p>
      </div>
    )
  }

  if (status === 'generating') {
    return (
      <div className="aspect-video w-full rounded-md border border-border bg-muted/30 flex items-center justify-center animate-pulse">
        <p className="text-xs text-muted-foreground">Generating...</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="aspect-video w-full rounded-md border border-destructive/50 bg-destructive/10 flex items-center justify-center">
        <p className="text-xs text-destructive">Generation failed</p>
      </div>
    )
  }

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt="Generated frame"
        className="aspect-video w-full rounded-md object-cover border border-border"
      />
    )
  }

  return (
    <div className="aspect-video w-full rounded-md border border-border bg-muted/30 animate-pulse" />
  )
}

function VideoPage() {
  const { session } = useAuth()

  // First frame state
  const [firstFrameModel, setFirstFrameModel] = useState(
    FIRST_FRAME_MODELS[0].id,
  )
  const [firstFramePrompt, setFirstFramePrompt] = useState(
    DEFAULT_FIRST_FRAME_PROMPT,
  )
  const [firstFrameStatus, setFirstFrameStatus] = useState<FrameStatus>('idle')
  const [firstFrameRecordId, setFirstFrameRecordId] = useState<string | null>(
    null,
  )
  const [firstFrameUrl, setFirstFrameUrl] = useState<string | null>(null)
  const [firstFrameError, setFirstFrameError] = useState<string | null>(null)

  // Last frame state
  const [lastFramePrompt, setLastFramePrompt] = useState(
    DEFAULT_LAST_FRAME_PROMPT,
  )
  const [lastFrameStatus, setLastFrameStatus] = useState<FrameStatus>('idle')
  const [suggestingLastFrame, setSuggestingLastFrame] = useState(false)
  const [lastFrameRecordId, setLastFrameRecordId] = useState<string | null>(
    null,
  )
  const [lastFrameUrl, setLastFrameUrl] = useState<string | null>(null)
  const [lastFrameError, setLastFrameError] = useState<string | null>(null)

  // Video state
  const [videoStatus, setVideoStatus] = useState<VideoStatus>('idle')
  const [videoRecordId, setVideoRecordId] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoError, setVideoError] = useState<string | null>(null)

  // Poll for first frame completion
  const checkFirstFrame = useCallback(async () => {
    if (!session?.access_token || !firstFrameRecordId) return

    try {
      await checkPendingImages({
        data: {
          accessToken: session.access_token,
          recordIds: [firstFrameRecordId],
        },
      })

      const { data: recordData } = await supabase
        .from('user_images')
        .select('status, storage_path')
        .eq('id', firstFrameRecordId)
        .single()

      const record = recordData as unknown as {
        status: string
        storage_path: string | null
      } | null

      if (record?.status === 'completed' && record.storage_path) {
        const { data: urlData } = await supabase.storage
          .from('user-images')
          .createSignedUrl(record.storage_path, 3600)
        if (urlData) {
          setFirstFrameUrl(urlData.signedUrl)
          setFirstFrameStatus('completed')
        }
      } else if (record?.status === 'failed') {
        setFirstFrameStatus('error')
        setFirstFrameError('Frame generation failed')
      }
    } catch {
      // keep polling
    }
  }, [session?.access_token, firstFrameRecordId])

  useEffect(() => {
    if (firstFrameStatus !== 'generating' || !firstFrameRecordId) return
    const interval = setInterval(checkFirstFrame, 3000)
    return () => clearInterval(interval)
  }, [firstFrameStatus, firstFrameRecordId, checkFirstFrame])

  // Poll for last frame completion
  const checkLastFrame = useCallback(async () => {
    if (!session?.access_token || !lastFrameRecordId) return

    try {
      await checkPendingImages({
        data: {
          accessToken: session.access_token,
          recordIds: [lastFrameRecordId],
        },
      })

      const { data: lastRecordData } = await supabase
        .from('user_images')
        .select('status, storage_path')
        .eq('id', lastFrameRecordId)
        .single()

      const lastRecord = lastRecordData as unknown as {
        status: string
        storage_path: string | null
      } | null

      if (lastRecord?.status === 'completed' && lastRecord.storage_path) {
        const { data: urlData } = await supabase.storage
          .from('user-images')
          .createSignedUrl(lastRecord.storage_path, 3600)
        if (urlData) {
          setLastFrameUrl(urlData.signedUrl)
          setLastFrameStatus('completed')
        }
      } else if (lastRecord?.status === 'failed') {
        setLastFrameStatus('error')
        setLastFrameError('Frame generation failed')
      }
    } catch {
      // keep polling
    }
  }, [session?.access_token, lastFrameRecordId])

  useEffect(() => {
    if (lastFrameStatus !== 'generating' || !lastFrameRecordId) return
    const interval = setInterval(checkLastFrame, 3000)
    return () => clearInterval(interval)
  }, [lastFrameStatus, lastFrameRecordId, checkLastFrame])

  // Poll for video completion
  const checkVideo = useCallback(async () => {
    if (!session?.access_token || !videoRecordId) return

    try {
      const result = await checkPendingVideo({
        data: {
          accessToken: session.access_token,
          recordId: videoRecordId,
        },
      })

      if (result.status === 'completed' && result.storagePath) {
        const { data: urlData } = await supabase.storage
          .from('user-images')
          .createSignedUrl(result.storagePath, 7200)
        if (urlData) {
          setVideoUrl(urlData.signedUrl)
          setVideoStatus('completed')
        }
      } else if (result.status === 'error') {
        setVideoStatus('error')
        setVideoError(result.error || 'Video generation failed')
      }
    } catch {
      // keep polling
    }
  }, [session?.access_token, videoRecordId])

  useEffect(() => {
    if (videoStatus !== 'generating' || !videoRecordId) return
    const interval = setInterval(checkVideo, 5000)
    return () => clearInterval(interval)
  }, [videoStatus, videoRecordId, checkVideo])

  async function handleGenerateFirstFrame() {
    if (!session?.access_token || !firstFramePrompt.trim()) return

    setFirstFrameStatus('generating')
    setFirstFrameUrl(null)
    setFirstFrameRecordId(null)
    setFirstFrameError(null)
    // Reset downstream
    setLastFrameStatus('idle')
    setLastFrameUrl(null)
    setLastFrameRecordId(null)
    setVideoStatus('idle')
    setVideoUrl(null)
    setVideoRecordId(null)

    try {
      const result = await generateFirstFrame({
        data: {
          prompt: firstFramePrompt,
          model: firstFrameModel,
          accessToken: session.access_token,
        },
      })
      setFirstFrameRecordId(result.recordId)
    } catch (err) {
      setFirstFrameStatus('error')
      setFirstFrameError(
        err instanceof Error ? err.message : 'Failed to generate first frame',
      )
    }
  }

  async function handleGenerateLastFrame() {
    if (
      !session?.access_token ||
      !lastFramePrompt.trim() ||
      !firstFrameRecordId ||
      firstFrameStatus !== 'completed'
    )
      return

    setLastFrameStatus('generating')
    setLastFrameUrl(null)
    setLastFrameRecordId(null)
    setLastFrameError(null)
    // Reset video
    setVideoStatus('idle')
    setVideoUrl(null)
    setVideoRecordId(null)

    try {
      const result = await generateLastFrame({
        data: {
          prompt: lastFramePrompt,
          firstFrameRecordId,
          accessToken: session.access_token,
        },
      })
      setLastFrameRecordId(result.recordId)
    } catch (err) {
      setLastFrameStatus('error')
      setLastFrameError(
        err instanceof Error ? err.message : 'Failed to generate last frame',
      )
    }
  }

  async function handleGenerateVideo() {
    if (
      !session?.access_token ||
      !firstFrameRecordId ||
      !lastFrameRecordId ||
      firstFrameStatus !== 'completed' ||
      lastFrameStatus !== 'completed'
    )
      return

    setVideoStatus('generating')
    setVideoUrl(null)
    setVideoRecordId(null)
    setVideoError(null)

    try {
      const result = await generateFlfVideo({
        data: {
          firstFrameRecordId,
          lastFrameRecordId,
          prompt: '',
          accessToken: session.access_token,
        },
      })
      setVideoRecordId(result.recordId)
    } catch (err) {
      setVideoStatus('error')
      setVideoError(
        err instanceof Error ? err.message : 'Failed to generate video',
      )
    }
  }

  async function handleSuggestLastFrame() {
    if (!session?.access_token || firstFrameStatus !== 'completed') return

    setSuggestingLastFrame(true)
    try {
      const result = await suggestLastFrame({
        data: {
          accessToken: session.access_token,
          firstFramePrompt,
          firstFrameRecordId: firstFrameRecordId ?? undefined,
        },
      })
      setLastFramePrompt(result.prompt)
    } catch {
      // fail silently — user still has their existing prompt
    } finally {
      setSuggestingLastFrame(false)
    }
  }

  const lastFrameLocked = firstFrameStatus !== 'completed'
  const canGenerateVideo =
    firstFrameStatus === 'completed' && lastFrameStatus === 'completed'

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Video</h1>

      {/* Frame panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* First Frame */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">First Frame</h2>
            <div className="flex gap-1">
              {FIRST_FRAME_MODELS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setFirstFrameModel(m.id)}
                  disabled={firstFrameStatus === 'generating'}
                  className={cn(
                    'px-2 py-1 text-xs rounded border transition-colors',
                    firstFrameModel === m.id
                      ? 'border-accent-gold bg-accent-gold/10 text-foreground'
                      : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <FrameImageArea
            status={firstFrameStatus}
            imageUrl={firstFrameUrl}
            placeholder="First frame will appear here"
          />

          <Textarea
            placeholder="Describe the opening scene..."
            value={firstFramePrompt}
            onChange={(e) => setFirstFramePrompt(e.target.value)}
            disabled={firstFrameStatus === 'generating'}
            rows={3}
          />

          {firstFrameError && (
            <p className="text-xs text-destructive">{firstFrameError}</p>
          )}

          <Button
            onClick={handleGenerateFirstFrame}
            disabled={
              firstFrameStatus === 'generating' || !firstFramePrompt.trim()
            }
            className="w-full"
          >
            {firstFrameStatus === 'generating'
              ? 'Generating...'
              : firstFrameStatus === 'completed'
                ? 'Regenerate First Frame'
                : 'Generate First Frame'}
          </Button>
        </div>

        {/* Last Frame */}
        <div
          className={cn(
            'space-y-3 transition-opacity',
            lastFrameLocked && 'opacity-40 pointer-events-none',
          )}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Last Frame</h2>
            <span className="text-xs text-muted-foreground">Kontext Max</span>
          </div>

          <FrameImageArea
            status={lastFrameStatus}
            imageUrl={lastFrameUrl}
            placeholder={
              lastFrameLocked
                ? 'Generate first frame first'
                : 'Last frame will appear here'
            }
          />

          <div className="relative">
            <Textarea
              placeholder="Describe how the scene evolves..."
              value={lastFramePrompt}
              onChange={(e) => setLastFramePrompt(e.target.value)}
              disabled={lastFrameStatus === 'generating' || lastFrameLocked}
              rows={3}
            />
            {!lastFrameLocked && (
              <button
                onClick={handleSuggestLastFrame}
                disabled={
                  suggestingLastFrame || lastFrameStatus === 'generating'
                }
                className="absolute bottom-2 right-2 text-[10px] text-muted-foreground hover:text-foreground bg-background/80 backdrop-blur-sm px-1.5 py-0.5 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {suggestingLastFrame ? 'Suggesting...' : 'Suggest'}
              </button>
            )}
          </div>

          {lastFrameError && (
            <p className="text-xs text-destructive">{lastFrameError}</p>
          )}

          <Button
            onClick={handleGenerateLastFrame}
            disabled={
              lastFrameLocked ||
              lastFrameStatus === 'generating' ||
              !lastFramePrompt.trim()
            }
            className="w-full"
          >
            {lastFrameStatus === 'generating'
              ? 'Generating...'
              : lastFrameStatus === 'completed'
                ? 'Regenerate Last Frame'
                : 'Generate Last Frame'}
          </Button>
        </div>
      </div>

      {/* Generate Video button — only when both frames ready */}
      {canGenerateVideo && (
        <div className="flex justify-center">
          <Button
            onClick={handleGenerateVideo}
            disabled={videoStatus === 'generating'}
            size="lg"
            className="min-w-[240px]"
          >
            {videoStatus === 'generating'
              ? 'Generating Video...'
              : videoStatus === 'completed'
                ? 'Regenerate Video'
                : 'Generate Video'}
          </Button>
        </div>
      )}

      {videoError && (
        <p className="text-sm text-destructive text-center">{videoError}</p>
      )}

      {/* Video pending state */}
      {videoStatus === 'generating' && (
        <div className="rounded-lg border border-border bg-muted/30 p-8 flex items-center justify-center">
          <div className="text-center space-y-2">
            <div className="animate-pulse h-2 w-48 mx-auto bg-muted-foreground/30 rounded-full" />
            <p className="text-sm text-muted-foreground">
              Wan FLF2V is processing — this takes 30–90 seconds
            </p>
          </div>
        </div>
      )}

      {/* Video player */}
      {videoStatus === 'completed' && videoUrl && (
        <div className="rounded-lg overflow-hidden border border-border bg-black">
          <video
            src={videoUrl}
            controls
            className="w-full"
            preload="metadata"
          />
        </div>
      )}
    </div>
  )
}
