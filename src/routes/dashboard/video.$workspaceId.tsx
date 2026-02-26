import { Link, createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { createWorkspace } from '@/features/ai-video/server/create-workspace.server'
import { deleteGeneration } from '@/features/ai-video/server/delete-generation.server'
import { getWorkspace } from '@/features/ai-video/server/get-workspace.server'
import { getWorkspaces } from '@/features/ai-video/server/get-workspaces.server'
import { moveGenerations } from '@/features/ai-video/server/move-generations.server'
import { renameWorkspace } from '@/features/ai-video/server/rename-workspace.server'
import { generateFirstFrame } from '@/features/ai-video/server/generate-first-frame.server'
import { generateLastFrame } from '@/features/ai-video/server/generate-last-frame.server'
import { generateFlfVideo } from '@/features/ai-video/server/generate-flf-video.server'
import { suggestLastFrame } from '@/features/ai-video/server/suggest-last-frame.server'
import { uploadVideoFrame } from '@/features/ai-video/server/upload-video-frame.server'
import { checkPendingImages } from '@/features/ai-images/server/check-pending-images.server'
import { checkPendingVideo } from '@/features/ai-video/server/check-pending-video.server'
import { createGeneration } from '@/features/ai-video/server/create-generation.server'
import { getGenerations } from '@/features/ai-video/server/get-generations.server'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/dashboard/video/$workspaceId')({
  component: WorkspaceDetailPage,
})

const DEFAULT_FIRST_FRAME_PROMPT =
  'A visceral side-mounted camera angle hugging just above the wheel arch of a red-and-white 1980s Formula 1 car blasting out of the Monaco tunnel into blinding Mediterranean sunlight. Tire sidewalls ripple with speed, polished livery shimmers, chrome suspension arms catch the light. Vintage 35mm racing documentary aesthetic, natural motion blur, golden hour.'

const FIRST_FRAME_MODELS = [
  { id: 'fal-ai/flux-pro/kontext/text-to-image', label: 'FLUX Kontext Pro' },
  { id: 'fal-ai/kling-image/o3/text-to-image', label: 'Kling Image O3' },
]

const FLUX_KONTEXT_MODEL_ID = 'fal-ai/flux-pro/kontext/text-to-image'

const LAST_FRAME_MODEL = 'nano-banana' as const
type FrameStatus = 'idle' | 'generating' | 'completed' | 'error'
type LastFrameMode = 'prompt' | 'image'

type Generation = {
  id: string
  createdAt: string
  firstFrame: { id: string; url: string | null } | null
  lastFrame: { id: string; url: string | null } | null
  video: {
    id: string
    url: string | null
    status: 'pending' | 'completed' | 'failed'
  } | null
}

function cropTo16x9(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)

      const targetAspect = 16 / 9
      const srcAspect = img.width / img.height
      let sx = 0,
        sy = 0,
        sw = img.width,
        sh = img.height

      if (srcAspect > targetAspect) {
        sw = Math.round(img.height * targetAspect)
        sx = Math.round((img.width - sw) / 2)
      } else {
        sh = Math.round(img.width / targetAspect)
        sy = Math.round((img.height - sh) / 2)
      }

      const canvas = document.createElement('canvas')
      canvas.width = 1280
      canvas.height = 720
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Could not get canvas context'))
        return
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 1280, 720)
      resolve(canvas.toDataURL('image/jpeg', 0.92))
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Failed to load image'))
    }

    img.src = objectUrl
  })
}

function FrameImageArea({
  status,
  imageUrl,
  placeholder,
  generatingLabel = 'Generating...',
  onChooseImage,
}: {
  status: FrameStatus
  imageUrl: string | null
  placeholder: string
  generatingLabel?: string
  onChooseImage?: () => void
}) {
  if (imageUrl && status !== 'generating') {
    return (
      <div className="relative group">
        <img
          src={imageUrl}
          alt="Frame"
          className="aspect-video w-full rounded-md object-cover border border-border"
        />
        {onChooseImage && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 rounded-md">
            <Button variant="outline" size="sm" onClick={onChooseImage}>
              Change Image
            </Button>
          </div>
        )}
      </div>
    )
  }

  if (status === 'generating') {
    return (
      <div className="aspect-video w-full rounded-md border border-border bg-muted/30 flex items-center justify-center animate-pulse">
        <p className="text-xs text-muted-foreground">{generatingLabel}</p>
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

  return (
    <div className="aspect-video w-full rounded-md border border-dashed border-border bg-muted/30 flex items-center justify-center">
      {onChooseImage ? (
        <Button variant="outline" size="sm" onClick={onChooseImage}>
          Choose Image
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">{placeholder}</p>
      )}
    </div>
  )
}

function GenerationRow({
  generation,
  selected,
  onToggleSelect,
  onLoad,
  onContinue,
  onUpdate,
  onDelete,
  accessToken,
}: {
  generation: Generation
  selected: boolean
  onToggleSelect: (id: string) => void
  onLoad: (gen: Generation) => void
  onContinue: (gen: Generation) => void
  onUpdate: (id: string, updates: Partial<Generation>) => void
  onDelete: (id: string) => void
  accessToken: string | undefined
}) {
  const [videoOpen, setVideoOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const isPending = generation.video?.status === 'pending'

  // Poll for pending videos
  useEffect(() => {
    if (!isPending || !accessToken || !generation.video) return

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
    pollingRef.current = setInterval(poll, 5000)
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [isPending, accessToken, generation.video?.id, generation.id, onUpdate])

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
        {generation.lastFrame?.url ? (
          <img
            src={generation.lastFrame.url}
            alt="Last frame"
            className="w-24 aspect-video rounded object-cover border border-border"
          />
        ) : (
          <div className="w-24 aspect-video rounded border border-dashed border-border bg-muted/30" />
        )}
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
            disabled={!generation.lastFrame?.url}
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

function WorkspaceDetailPage() {
  const { workspaceId } = Route.useParams()
  const { session } = useAuth()

  // Workspace name
  const [workspaceName, setWorkspaceName] = useState('')
  const [isEditingName, setIsEditingName] = useState(false)
  const [editNameValue, setEditNameValue] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!session?.access_token) return
    getWorkspace({
      data: { workspaceId, accessToken: session.access_token },
    }).then((ws) => setWorkspaceName(ws.name))
  }, [workspaceId, session?.access_token])

  const handleStartRename = () => {
    setEditNameValue(workspaceName)
    setIsEditingName(true)
    setTimeout(() => nameInputRef.current?.select(), 0)
  }

  const handleSaveRename = async () => {
    setIsEditingName(false)
    const trimmed = editNameValue.trim()
    if (!trimmed || trimmed === workspaceName || !session?.access_token) return
    setWorkspaceName(trimmed)
    try {
      await renameWorkspace({
        data: { workspaceId, name: trimmed, accessToken: session.access_token },
      })
    } catch (err) {
      console.error('Failed to rename workspace:', err)
    }
  }

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
  const lastFrameModel = LAST_FRAME_MODEL
  const [lastFrameMode, setLastFrameMode] = useState<LastFrameMode>('prompt')
  const [lastFramePrompt, setLastFramePrompt] = useState('')
  const [lastFrameImageData, setLastFrameImageData] = useState<string | null>(
    null,
  )
  const [lastFrameStatus, setLastFrameStatus] = useState<FrameStatus>('idle')
  const [lastFrameRecordId, setLastFrameRecordId] = useState<string | null>(
    null,
  )
  const [lastFrameUrl, setLastFrameUrl] = useState<string | null>(null)
  const [lastFrameError, setLastFrameError] = useState<string | null>(null)
  const [suggestingLastFrame, setSuggestingLastFrame] = useState(false)

  // Generations list
  const [generations, setGenerations] = useState<Array<Generation>>([])
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false)

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isMoving, setIsMoving] = useState(false)
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [moveDialogOpen, setMoveDialogOpen] = useState(false)
  const [targetWorkspaceId, setTargetWorkspaceId] = useState<string | null>(
    null,
  )
  const [availableWorkspaces, setAvailableWorkspaces] = useState<
    Array<{
      id: string
      name: string
      generationCount: number
      preview: { heroUrl: string | null }
    }>
  >([])

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const firstFrameFileInputRef = useRef<HTMLInputElement>(null)
  const lastFrameFileInputRef = useRef<HTMLInputElement>(null)

  const isFluxKontextMode = firstFrameModel === FLUX_KONTEXT_MODEL_ID

  // Load generations on mount
  useEffect(() => {
    if (!session?.access_token) return
    getGenerations({
      data: { workspaceId, accessToken: session.access_token },
    })
      .then(setGenerations)
      .catch(() => {})
  }, [workspaceId, session?.access_token])

  function resetAllState() {
    setFirstFrameStatus('idle')
    setFirstFrameUrl(null)
    setFirstFrameRecordId(null)
    setFirstFrameError(null)
    setLastFrameStatus('idle')
    setLastFrameUrl(null)
    setLastFrameRecordId(null)
    setLastFrameError(null)
    setLastFramePrompt('')
    setLastFrameImageData(null)
  }

  function resetDownstream() {
    setLastFrameStatus('idle')
    setLastFrameUrl(null)
    setLastFrameRecordId(null)
    setLastFrameError(null)
  }

  function handleModelChange(modelId: string) {
    if (firstFrameStatus === 'generating') return
    setFirstFrameModel(modelId)
    setFirstFrameStatus('idle')
    setFirstFrameUrl(null)
    setFirstFrameRecordId(null)
    setFirstFrameError(null)
    resetDownstream()
  }

  function handleLastFrameModeChange(mode: LastFrameMode) {
    if (lastFrameStatus === 'generating') return
    setLastFrameMode(mode)
    setLastFrameImageData(null)
    setLastFrameStatus('idle')
    setLastFrameUrl(null)
    setLastFrameRecordId(null)
    setLastFrameError(null)
  }

  async function handleFirstFrameFilePick(
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = e.target.files?.[0]
    if (!file || !session?.access_token) return
    e.target.value = ''

    let dataUrl: string
    try {
      dataUrl = await cropTo16x9(file)
    } catch {
      setFirstFrameError('Failed to process image')
      return
    }

    setFirstFrameUrl(dataUrl)
    setFirstFrameStatus('generating')
    setFirstFrameRecordId(null)
    setFirstFrameError(null)
    resetDownstream()

    try {
      const result = await uploadVideoFrame({
        data: {
          imageBase64: dataUrl,
          frameType: 'first',
          accessToken: session.access_token,
        },
      })
      setFirstFrameRecordId(result.recordId)
      setFirstFrameUrl(result.signedUrl)
      setFirstFrameStatus('completed')
    } catch (err) {
      setFirstFrameStatus('error')
      setFirstFrameError(
        err instanceof Error ? err.message : 'Failed to upload frame',
      )
    }
  }

  async function handleLastFrameFilePick(
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    try {
      const dataUrl = await cropTo16x9(file)
      setLastFrameImageData(dataUrl)
      setLastFrameStatus('idle')
      setLastFrameUrl(dataUrl)
    } catch {
      setLastFrameError('Failed to process image')
    }
  }

  // Poll for first frame (Kling mode only)
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
      const record = recordData as {
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
    if (isFluxKontextMode) return
    const interval = setInterval(checkFirstFrame, 3000)
    return () => clearInterval(interval)
  }, [firstFrameStatus, firstFrameRecordId, checkFirstFrame, isFluxKontextMode])

  // Poll for last frame
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
      const lastRecord = lastRecordData as {
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
    if (lastFrameMode === 'image') return
    const interval = setInterval(checkLastFrame, 3000)
    return () => clearInterval(interval)
  }, [lastFrameStatus, lastFrameRecordId, checkLastFrame, lastFrameMode])

  async function handleGenerateFirstFrame() {
    if (!session?.access_token || !firstFramePrompt.trim()) return
    setFirstFrameStatus('generating')
    setFirstFrameUrl(null)
    setFirstFrameRecordId(null)
    setFirstFrameError(null)
    resetDownstream()
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
      !firstFrameRecordId ||
      firstFrameStatus !== 'completed'
    )
      return

    if (lastFrameMode === 'image') {
      if (!lastFrameImageData) return
      setLastFrameStatus('generating')
      setLastFrameUrl(null)
      setLastFrameRecordId(null)
      setLastFrameError(null)
      try {
        const result = await uploadVideoFrame({
          data: {
            imageBase64: lastFrameImageData,
            frameType: 'last',
            accessToken: session.access_token,
          },
        })
        setLastFrameRecordId(result.recordId)
        setLastFrameUrl(result.signedUrl)
        setLastFrameStatus('completed')
      } catch (err) {
        setLastFrameStatus('error')
        setLastFrameError(
          err instanceof Error ? err.message : 'Failed to upload frame',
        )
      }
      return
    }

    if (!lastFramePrompt.trim()) return
    setLastFrameStatus('generating')
    setLastFrameUrl(null)
    setLastFrameRecordId(null)
    setLastFrameError(null)
    try {
      const result = await generateLastFrame({
        data: {
          prompt: lastFramePrompt,
          firstFrameRecordId,
          model: lastFrameModel,
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

    setIsGeneratingVideo(true)

    try {
      // Kick off video generation
      const result = await generateFlfVideo({
        data: {
          firstFrameRecordId,
          lastFrameRecordId,
          prompt: '',
          accessToken: session.access_token,
        },
      })

      // Capture current frame data before resetting
      const capturedFirstFrameUrl = firstFrameUrl
      const capturedFirstFrameRecordId = firstFrameRecordId
      const capturedLastFrameUrl = lastFrameUrl
      const capturedLastFrameRecordId = lastFrameRecordId

      // Create generation record immediately with pending video
      const gen = await createGeneration({
        data: {
          workspaceId,
          firstFrameId: capturedFirstFrameRecordId,
          lastFrameId: capturedLastFrameRecordId,
          videoId: result.recordId,
          accessToken: session.access_token,
        },
      })

      // Add optimistic generation to list
      const newGeneration: Generation = {
        id: gen.id,
        createdAt: new Date().toISOString(),
        firstFrame: capturedFirstFrameRecordId
          ? { id: capturedFirstFrameRecordId, url: capturedFirstFrameUrl }
          : null,
        lastFrame: capturedLastFrameRecordId
          ? { id: capturedLastFrameRecordId, url: capturedLastFrameUrl }
          : null,
        video: { id: result.recordId, url: null, status: 'pending' },
      }

      setGenerations((prev) => [newGeneration, ...prev])

      // Reset form for next generation
      resetAllState()
    } catch (err) {
      // Don't reset on error -- let user retry
      console.error('Failed to generate video:', err)
    } finally {
      setIsGeneratingVideo(false)
    }
  }

  const handleUpdateGeneration = useCallback(
    (id: string, updates: Partial<Generation>) => {
      setGenerations((prev) =>
        prev.map((gen) => (gen.id === id ? { ...gen, ...updates } : gen)),
      )
    },
    [],
  )

  const handleDeleteGeneration = useCallback(
    (id: string) => {
      setGenerations((prev) => prev.filter((gen) => gen.id !== id))
      // If the deleted generation was loaded in the form, clear form state
      if (
        firstFrameRecordId &&
        generations.find((g) => g.id === id)?.firstFrame?.id ===
          firstFrameRecordId
      ) {
        resetAllState()
      }
    },
    [firstFrameRecordId, generations],
  )

  async function handleSuggestLastFrame() {
    if (!session?.access_token || firstFrameStatus !== 'completed') return
    setSuggestingLastFrame(true)
    try {
      const result = await suggestLastFrame({
        data: {
          accessToken: session.access_token,
          firstFramePrompt: isFluxKontextMode ? '' : firstFramePrompt,
          firstFrameRecordId: firstFrameRecordId ?? undefined,
        },
      })
      setLastFramePrompt(result.prompt)
    } catch {
      // fail silently
    } finally {
      setSuggestingLastFrame(false)
    }
  }

  function handleLoadGeneration(gen: Generation) {
    if (gen.firstFrame) {
      setFirstFrameStatus('completed')
      setFirstFrameRecordId(gen.firstFrame.id)
      setFirstFrameUrl(gen.firstFrame.url)
      setFirstFrameError(null)
    }
    if (gen.lastFrame) {
      setLastFrameStatus('completed')
      setLastFrameRecordId(gen.lastFrame.id)
      setLastFrameUrl(gen.lastFrame.url)
      setLastFrameError(null)
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleContinueGeneration(gen: Generation) {
    if (!gen.lastFrame?.url) return
    resetAllState()
    setFirstFrameRecordId(gen.lastFrame.id)
    setFirstFrameUrl(gen.lastFrame.url)
    setFirstFrameStatus('completed')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const lastFrameLocked = firstFrameStatus !== 'completed'
  const canGenerateVideo =
    firstFrameStatus === 'completed' && lastFrameStatus === 'completed'

  const lastFrameGenerateDisabled =
    lastFrameLocked ||
    lastFrameStatus === 'generating' ||
    (lastFrameMode === 'prompt' && !lastFramePrompt.trim()) ||
    (lastFrameMode === 'image' && !lastFrameImageData)

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <Link
          to="/dashboard/video"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Video
        </Link>
        <span className="text-xs text-muted-foreground">/</span>
        {isEditingName ? (
          <input
            ref={nameInputRef}
            value={editNameValue}
            onChange={(e) => setEditNameValue(e.target.value)}
            onBlur={handleSaveRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveRename()
              if (e.key === 'Escape') setIsEditingName(false)
            }}
            className="text-sm font-medium bg-transparent border-b border-foreground/30 outline-none px-0 py-0 w-48"
          />
        ) : (
          <button
            onClick={handleStartRename}
            className="text-sm font-medium hover:text-foreground/70 transition-colors cursor-text"
          >
            {workspaceName || 'Untitled'}
          </button>
        )}
      </div>

      <input
        ref={firstFrameFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFirstFrameFilePick}
      />
      <input
        ref={lastFrameFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleLastFrameFilePick}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* First Frame */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">First Frame</h2>
            <div className="flex gap-1">
              {FIRST_FRAME_MODELS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => handleModelChange(m.id)}
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
            generatingLabel="Uploading..."
            onChooseImage={
              isFluxKontextMode && firstFrameStatus !== 'generating'
                ? () => firstFrameFileInputRef.current?.click()
                : undefined
            }
          />

          {!isFluxKontextMode && (
            <Textarea
              placeholder="Describe the opening scene..."
              value={firstFramePrompt}
              onChange={(e) => setFirstFramePrompt(e.target.value)}
              disabled={firstFrameStatus === 'generating'}
              rows={6}
            />
          )}

          {firstFrameError && (
            <p className="text-xs text-destructive">{firstFrameError}</p>
          )}

          {!isFluxKontextMode && (
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
          )}
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
            <div className="flex gap-1">
              {(['prompt', 'image'] as Array<LastFrameMode>).map((mode) => (
                <button
                  key={mode}
                  onClick={() => handleLastFrameModeChange(mode)}
                  disabled={lastFrameStatus === 'generating'}
                  className={cn(
                    'px-2 py-1 text-xs rounded border transition-colors capitalize',
                    lastFrameMode === mode
                      ? 'border-accent-gold bg-accent-gold/10 text-foreground'
                      : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <FrameImageArea
            status={lastFrameStatus}
            imageUrl={lastFrameUrl}
            placeholder={
              lastFrameLocked
                ? 'Generate first frame first'
                : 'Last frame will appear here'
            }
            generatingLabel="Generating..."
            onChooseImage={
              lastFrameMode === 'image' &&
              lastFrameStatus !== 'generating' &&
              !lastFrameLocked
                ? () => lastFrameFileInputRef.current?.click()
                : undefined
            }
          />

          {lastFrameMode === 'prompt' && !lastFrameLocked && (
            <div className="relative">
              <Textarea
                placeholder="Describe what changes in the scene..."
                value={lastFramePrompt}
                onChange={(e) => setLastFramePrompt(e.target.value)}
                disabled={lastFrameStatus === 'generating'}
                rows={4}
              />
              <button
                onClick={handleSuggestLastFrame}
                disabled={
                  suggestingLastFrame || lastFrameStatus === 'generating'
                }
                className="absolute bottom-2 right-2 text-[10px] text-muted-foreground hover:text-foreground bg-background/80 backdrop-blur-sm px-1.5 py-0.5 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {suggestingLastFrame ? 'Suggesting...' : 'Suggest'}
              </button>
            </div>
          )}

          {lastFrameError && (
            <p className="text-xs text-destructive">{lastFrameError}</p>
          )}

          <Button
            onClick={handleGenerateLastFrame}
            disabled={lastFrameGenerateDisabled}
            className="w-full"
          >
            {lastFrameStatus === 'generating'
              ? 'Generating...'
              : 'Generate Last Frame'}
          </Button>
        </div>
      </div>

      {canGenerateVideo && (
        <div className="flex justify-center">
          <Button
            onClick={handleGenerateVideo}
            disabled={isGeneratingVideo}
            size="lg"
            className="min-w-[240px]"
          >
            {isGeneratingVideo ? 'Starting...' : 'Generate Video'}
          </Button>
        </div>
      )}

      {/* Generations list */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium">Generations</h2>
        {generations.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 flex items-center justify-center">
            <p className="text-xs text-muted-foreground">
              Generated videos will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {generations.map((gen) => (
              <GenerationRow
                key={gen.id}
                generation={gen}
                selected={selectedIds.has(gen.id)}
                onToggleSelect={toggleSelect}
                onLoad={handleLoadGeneration}
                onContinue={handleContinueGeneration}
                onUpdate={handleUpdateGeneration}
                onDelete={handleDeleteGeneration}
                accessToken={session?.access_token}
              />
            ))}
          </div>
        )}
      </div>

      {/* Floating selection bar */}
      <div
        className={cn(
          'fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg border border-border bg-background/95 backdrop-blur-sm px-5 py-3 shadow-lg transition-all duration-200',
          selectedIds.size > 0
            ? 'translate-y-0 opacity-100'
            : 'translate-y-4 opacity-0 pointer-events-none',
        )}
      >
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {selectedIds.size} selected
        </span>
        <Button
          size="sm"
          disabled={isMoving || selectedIds.size === 0}
          onClick={() => {
            setNewWorkspaceName('')
            setCreateDialogOpen(true)
          }}
        >
          New workspace
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={isMoving || selectedIds.size === 0}
          onClick={async () => {
            if (!session?.access_token) return
            try {
              const all = await getWorkspaces({
                data: { accessToken: session.access_token },
              })
              setAvailableWorkspaces(all.filter((ws) => ws.id !== workspaceId))
              setTargetWorkspaceId(null)
              setMoveDialogOpen(true)
            } catch (err) {
              console.error('Failed to load workspaces:', err)
            }
          }}
        >
          Move to workspace
        </Button>
        <button
          onClick={() => setSelectedIds(new Set())}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>

      {/* Create new workspace dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New workspace</DialogTitle>
          </DialogHeader>
          <input
            type="text"
            value={newWorkspaceName}
            onChange={(e) => setNewWorkspaceName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newWorkspaceName.trim()) {
                ;(
                  e.currentTarget
                    .closest('[role="dialog"]')
                    ?.querySelector(
                      '[data-create-confirm]',
                    ) as HTMLButtonElement | null
                )?.click()
              }
            }}
            placeholder="Workspace name"
            autoFocus
            className="h-9 px-3 text-sm rounded border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent-gold w-full"
          />
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCreateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              data-create-confirm
              disabled={!newWorkspaceName.trim() || isMoving}
              onClick={async () => {
                if (
                  !session?.access_token ||
                  !newWorkspaceName.trim() ||
                  selectedIds.size === 0
                )
                  return
                setIsMoving(true)
                try {
                  const newWs = await createWorkspace({
                    data: {
                      name: newWorkspaceName.trim(),
                      accessToken: session.access_token,
                    },
                  })
                  await moveGenerations({
                    data: {
                      generationIds: [...selectedIds],
                      targetWorkspaceId: newWs.id,
                      accessToken: session.access_token,
                    },
                  })
                  setGenerations((prev) =>
                    prev.filter((g) => !selectedIds.has(g.id)),
                  )
                  setSelectedIds(new Set())
                  setCreateDialogOpen(false)
                  setNewWorkspaceName('')
                } catch (err) {
                  console.error('Failed to create workspace:', err)
                } finally {
                  setIsMoving(false)
                }
              }}
            >
              {isMoving ? 'Creating...' : 'Done'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move to workspace dialog */}
      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Move to workspace</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 max-h-80 overflow-y-auto py-2">
            {availableWorkspaces.length === 0 ? (
              <p className="col-span-2 text-sm text-muted-foreground text-center py-6">
                No other workspaces found
              </p>
            ) : (
              availableWorkspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => setTargetWorkspaceId(ws.id)}
                  className={cn(
                    'rounded-lg border p-2 text-left transition-colors',
                    targetWorkspaceId === ws.id
                      ? 'border-accent-gold bg-accent-gold/5'
                      : 'border-border hover:bg-muted/30',
                  )}
                >
                  {ws.preview.heroUrl ? (
                    <img
                      src={ws.preview.heroUrl}
                      alt={ws.name}
                      className="aspect-video w-full rounded object-cover mb-2"
                    />
                  ) : (
                    <div className="aspect-video w-full rounded bg-muted/30 mb-2" />
                  )}
                  <p className="text-sm font-medium truncate">{ws.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {ws.generationCount} generation
                    {ws.generationCount !== 1 ? 's' : ''}
                  </p>
                </button>
              ))
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMoveDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!targetWorkspaceId || isMoving}
              onClick={async () => {
                if (
                  !session?.access_token ||
                  !targetWorkspaceId ||
                  selectedIds.size === 0
                )
                  return
                setIsMoving(true)
                try {
                  await moveGenerations({
                    data: {
                      generationIds: [...selectedIds],
                      targetWorkspaceId,
                      accessToken: session.access_token,
                    },
                  })
                  setGenerations((prev) =>
                    prev.filter((g) => !selectedIds.has(g.id)),
                  )
                  setSelectedIds(new Set())
                  setMoveDialogOpen(false)
                  setTargetWorkspaceId(null)
                } catch (err) {
                  console.error('Failed to move generations:', err)
                } finally {
                  setIsMoving(false)
                }
              }}
            >
              {isMoving ? 'Moving...' : 'Done'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
