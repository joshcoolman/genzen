import { Link, createFileRoute } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import type { Generation, LastFrameMode } from '@/features/ai-video/types'
import { generateFirstFrame } from '@/features/ai-video/server/generate-first-frame.server'
import { generateLastFrame } from '@/features/ai-video/server/generate-last-frame.server'
import { generateFlfVideo } from '@/features/ai-video/server/generate-flf-video.server'
import { suggestLastFrame } from '@/features/ai-video/server/suggest-last-frame.server'
import { uploadVideoFrame } from '@/features/ai-video/server/upload-video-frame.server'
import { createGeneration } from '@/features/ai-video/server/create-generation.server'
import { updateGeneration } from '@/features/ai-video/server/update-generation.server'
import { useAuth } from '@/lib/auth'
import { useCredits } from '@/features/credits/hooks/use-credits'
import { CREDIT_COSTS } from '@/features/credits'
import { cropTo16x9 } from '@/features/ai-video/lib/crop-to-16x9'
import { useFrame } from '@/features/ai-video/hooks/use-frame'
import { useWorkspaceName } from '@/features/ai-video/hooks/use-workspace-name'
import { useGenerations } from '@/features/ai-video/hooks/use-generations'
import { useGenerationSelection } from '@/features/ai-video/hooks/use-generation-selection'
import { GenerationRow } from '@/features/ai-video/components/GenerationRow'
import { FramePanel } from '@/features/ai-video/components/FramePanel'
import { SelectionBar } from '@/features/ai-video/components/SelectionBar'
import {
  DEFAULT_FIRST_FRAME_PROMPT,
  FIRST_FRAME_MODELS,
  FLUX_KONTEXT_MODEL_ID,
  LAST_FRAME_MODEL,
} from '@/features/ai-video/types'

export const Route = createFileRoute('/dashboard/video/$workspaceId')({
  component: WorkspaceDetailPage,
})

function WorkspaceDetailPage() {
  const { workspaceId } = Route.useParams()
  const { session } = useAuth()
  const accessToken = session?.access_token
  const credits = useCredits()

  // Workspace name
  const wsName = useWorkspaceName(workspaceId, accessToken)

  // First frame
  const [firstFrameModel, setFirstFrameModel] = useState(
    FIRST_FRAME_MODELS[0].id,
  )
  const [firstFramePrompt, setFirstFramePrompt] = useState(
    DEFAULT_FIRST_FRAME_PROMPT,
  )
  const isFluxKontextMode = firstFrameModel === FLUX_KONTEXT_MODEL_ID

  const firstFrame = useFrame({
    accessToken,
    shouldPoll: firstFrame_shouldPoll(),
  })

  // We need a stable reference for shouldPoll -- it depends on isFluxKontextMode
  // which is derived from firstFrameModel state. useFrame reads shouldPoll on each
  // effect cycle so this is fine as a function evaluated at render time.
  function firstFrame_shouldPoll() {
    return !isFluxKontextMode
  }

  // Last frame
  const [lastFrameMode, setLastFrameMode] = useState<LastFrameMode>('prompt')
  const [lastFramePrompt, setLastFramePrompt] = useState('')
  const [lastFrameImageData, setLastFrameImageData] = useState<string | null>(
    null,
  )
  const [suggestingLastFrame, setSuggestingLastFrame] = useState(false)

  const lastFrame = useFrame({
    accessToken,
    shouldPoll: lastFrameMode !== 'image',
  })

  // Generations
  const gens = useGenerations(workspaceId, accessToken)

  // Selection
  const selection = useGenerationSelection({
    workspaceId,
    accessToken,
    onMoved: gens.removeByIds,
  })

  // File input refs
  const firstFrameFileInputRef = useRef<HTMLInputElement>(null)
  const lastFrameFileInputRef = useRef<HTMLInputElement>(null)

  // Derived state
  const lastFrameLocked = firstFrame.status !== 'completed'
  const lastFrameGenerateDisabled =
    lastFrameLocked ||
    lastFrame.status === 'generating' ||
    (lastFrameMode === 'prompt' && !lastFramePrompt.trim()) ||
    (lastFrameMode === 'image' && !lastFrameImageData)

  // Handlers
  function resetAllState() {
    firstFrame.reset()
    lastFrame.reset()
    setLastFramePrompt('')
    setLastFrameImageData(null)
  }

  function resetDownstream() {
    lastFrame.reset()
  }

  function handleModelChange(modelId: string) {
    if (firstFrame.status === 'generating') return
    setFirstFrameModel(modelId)
    firstFrame.reset()
    resetDownstream()
  }

  function handleLastFrameModeChange(mode: LastFrameMode) {
    if (lastFrame.status === 'generating') return
    setLastFrameMode(mode)
    setLastFrameImageData(null)
    lastFrame.reset()
  }

  async function handleFirstFrameFilePick(
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = e.target.files?.[0]
    if (!file || !accessToken) return
    e.target.value = ''

    let dataUrl: string
    try {
      dataUrl = await cropTo16x9(file)
    } catch {
      firstFrame.setFailed('Failed to process image')
      return
    }

    firstFrame.setGenerating(dataUrl)
    resetDownstream()

    try {
      const result = await uploadVideoFrame({
        data: { imageBase64: dataUrl, frameType: 'first', accessToken },
      })
      firstFrame.setCompleted(result.signedUrl, result.recordId)
    } catch (err) {
      firstFrame.setFailed(
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
      lastFrame.setStatus('idle')
      lastFrame.setUrl(dataUrl)
    } catch {
      lastFrame.setFailed('Failed to process image')
    }
  }

  async function handleGenerateFirstFrame() {
    if (!accessToken || !firstFramePrompt.trim()) return
    firstFrame.setGenerating()
    resetDownstream()
    try {
      await credits.deduct(CREDIT_COSTS.first_frame, 'first_frame')
      const result = await generateFirstFrame({
        data: { prompt: firstFramePrompt, model: firstFrameModel, accessToken },
      })
      firstFrame.setRecordId(result.recordId)
    } catch (err) {
      firstFrame.setFailed(
        err instanceof Error ? err.message : 'Failed to generate first frame',
      )
    }
  }

  async function handleGenerateLastFrame() {
    if (
      !accessToken ||
      !firstFrame.recordId ||
      firstFrame.status !== 'completed'
    )
      return

    const capturedFirstFrameUrl = firstFrame.url
    const capturedFirstFrameRecordId = firstFrame.recordId

    if (lastFrameMode === 'image') {
      if (!lastFrameImageData) return
      lastFrame.setGenerating()
      try {
        await credits.deduct(CREDIT_COSTS.video_gen, 'video_gen')
        const result = await uploadVideoFrame({
          data: {
            imageBase64: lastFrameImageData,
            frameType: 'last',
            accessToken,
          },
        })

        // Create generation record immediately
        const gen = await createGeneration({
          data: {
            workspaceId,
            firstFrameId: capturedFirstFrameRecordId,
            lastFrameId: result.recordId,
            accessToken,
          },
        })

        const newGeneration: Generation = {
          id: gen.id,
          createdAt: new Date().toISOString(),
          firstFrame: {
            id: capturedFirstFrameRecordId,
            url: capturedFirstFrameUrl,
            status: 'completed',
          },
          lastFrame: {
            id: result.recordId,
            url: result.signedUrl,
            status: 'completed',
          },
          video: null,
        }
        gens.addGeneration(newGeneration)
        lastFrame.reset()
      } catch (err) {
        lastFrame.setFailed(
          err instanceof Error ? err.message : 'Failed to upload frame',
        )
      }
      return
    }

    if (!lastFramePrompt.trim()) return
    lastFrame.setGenerating()
    try {
      await credits.deduct(
        CREDIT_COSTS.last_frame + CREDIT_COSTS.video_gen,
        'video_gen',
      )
      const result = await generateLastFrame({
        data: {
          prompt: lastFramePrompt,
          firstFrameRecordId: capturedFirstFrameRecordId,
          model: LAST_FRAME_MODEL,
          accessToken,
        },
      })

      // Create generation record immediately with pending last frame
      const gen = await createGeneration({
        data: {
          workspaceId,
          firstFrameId: capturedFirstFrameRecordId,
          lastFrameId: result.recordId,
          accessToken,
        },
      })

      const newGeneration: Generation = {
        id: gen.id,
        createdAt: new Date().toISOString(),
        firstFrame: {
          id: capturedFirstFrameRecordId,
          url: capturedFirstFrameUrl,
          status: 'completed',
        },
        lastFrame: {
          id: result.recordId,
          url: null,
          status: 'pending',
        },
        video: null,
      }
      gens.addGeneration(newGeneration)
      lastFrame.reset()
    } catch (err) {
      lastFrame.setFailed(
        err instanceof Error ? err.message : 'Failed to generate last frame',
      )
    }
  }

  async function handleGenerateVideoFromRow(gen: Generation) {
    if (!accessToken || !gen.firstFrame?.id || !gen.lastFrame?.id) return

    try {
      const result = await generateFlfVideo({
        data: {
          firstFrameRecordId: gen.firstFrame.id,
          lastFrameRecordId: gen.lastFrame.id,
          prompt: '',
          accessToken,
        },
      })

      await updateGeneration({
        data: {
          generationId: gen.id,
          videoId: result.recordId,
          accessToken,
        },
      })

      gens.updateGeneration(gen.id, {
        video: { id: result.recordId, url: null, status: 'pending' },
      })
    } catch (err) {
      console.error('Failed to generate video:', err)
    }
  }

  async function handleSuggestLastFrame() {
    if (!accessToken || firstFrame.status !== 'completed') return
    setSuggestingLastFrame(true)
    try {
      const result = await suggestLastFrame({
        data: {
          accessToken,
          firstFramePrompt: isFluxKontextMode ? '' : firstFramePrompt,
          firstFrameRecordId: firstFrame.recordId ?? undefined,
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
      firstFrame.setCompleted(gen.firstFrame.url ?? '', gen.firstFrame.id)
    }
    if (gen.lastFrame) {
      lastFrame.setCompleted(gen.lastFrame.url ?? '', gen.lastFrame.id)
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleContinueGeneration(gen: Generation) {
    if (!gen.lastFrame?.url) return
    resetAllState()
    firstFrame.setCompleted(gen.lastFrame.url, gen.lastFrame.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleDeleteGeneration(id: string) {
    gens.deleteGeneration(id)
    if (
      firstFrame.recordId &&
      gens.generations.find((g) => g.id === id)?.firstFrame?.id ===
        firstFrame.recordId
    ) {
      resetAllState()
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <Link
          to="/dashboard/video"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Video
        </Link>
        {credits.balance !== null && (
          <span className="ml-auto text-sm text-muted-foreground tabular-nums">
            {credits.balance} credits
          </span>
        )}
        <span className="text-xs text-muted-foreground">/</span>
        {wsName.isEditing ? (
          <input
            ref={wsName.inputRef}
            value={wsName.editValue}
            onChange={(e) => wsName.setEditValue(e.target.value)}
            onBlur={wsName.saveRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') wsName.saveRename()
              if (e.key === 'Escape') wsName.cancelRename()
            }}
            className="text-sm font-medium bg-transparent border-b border-foreground/30 outline-none px-0 py-0 w-48"
          />
        ) : (
          <button
            onClick={wsName.startRename}
            className="text-sm font-medium hover:text-foreground/70 transition-colors cursor-text"
          >
            {wsName.name || 'Untitled'}
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
        <FramePanel
          type="first"
          model={firstFrameModel}
          onModelChange={handleModelChange}
          status={firstFrame.status}
          url={firstFrame.url}
          error={firstFrame.error}
          prompt={firstFramePrompt}
          onPromptChange={setFirstFramePrompt}
          isFluxKontextMode={isFluxKontextMode}
          onChooseImage={() => firstFrameFileInputRef.current?.click()}
          onGenerate={handleGenerateFirstFrame}
        />

        <FramePanel
          type="last"
          mode={lastFrameMode}
          onModeChange={handleLastFrameModeChange}
          status={lastFrame.status}
          url={lastFrame.url}
          error={lastFrame.error}
          locked={lastFrameLocked}
          prompt={lastFramePrompt}
          onPromptChange={setLastFramePrompt}
          suggesting={suggestingLastFrame}
          onSuggest={handleSuggestLastFrame}
          onChooseImage={() => lastFrameFileInputRef.current?.click()}
          onGenerate={handleGenerateLastFrame}
          generateDisabled={lastFrameGenerateDisabled}
        />
      </div>

      {firstFrame.status !== 'idle' && (
        <div className="flex justify-end">
          <button
            onClick={resetAllState}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            + Start new generation
          </button>
        </div>
      )}

      {/* Generations list */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium">Generations</h2>
        {gens.generations.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 flex items-center justify-center">
            <p className="text-xs text-muted-foreground">
              Generated videos will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {gens.generations.map((gen) => (
              <GenerationRow
                key={gen.id}
                generation={gen}
                selected={selection.selectedIds.has(gen.id)}
                onToggleSelect={selection.toggleSelect}
                onLoad={handleLoadGeneration}
                onContinue={handleContinueGeneration}
                onUpdate={gens.updateGeneration}
                onDelete={handleDeleteGeneration}
                onGenerateVideo={handleGenerateVideoFromRow}
                onLastFrameCompleted={(updatedGen) => {
                  if (
                    firstFrame.recordId &&
                    updatedGen.firstFrame?.id === firstFrame.recordId &&
                    updatedGen.lastFrame?.url
                  ) {
                    lastFrame.setCompleted(
                      updatedGen.lastFrame.url,
                      updatedGen.lastFrame.id,
                    )
                  }
                }}
                accessToken={accessToken}
              />
            ))}
          </div>
        )}
      </div>

      <SelectionBar
        selectedCount={selection.selectedIds.size}
        isMoving={selection.isMoving}
        onNewWorkspace={selection.openCreateDialog}
        onMoveToWorkspace={selection.openMoveDialog}
        onCancel={selection.clearSelection}
        createDialogOpen={selection.createDialogOpen}
        onCreateDialogChange={selection.setCreateDialogOpen}
        newWorkspaceName={selection.newWorkspaceName}
        onNewWorkspaceNameChange={selection.setNewWorkspaceName}
        onCreateConfirm={selection.handleCreateAndMove}
        moveDialogOpen={selection.moveDialogOpen}
        onMoveDialogChange={selection.setMoveDialogOpen}
        targetWorkspaceId={selection.targetWorkspaceId}
        onTargetChange={selection.setTargetWorkspaceId}
        availableWorkspaces={selection.availableWorkspaces}
        onMoveConfirm={selection.handleMoveToWorkspace}
      />
    </div>
  )
}
