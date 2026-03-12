import { useEffect, useRef } from 'react'
import type { Generation } from '@/features/ai-video/types'

import { useAuth } from '@/lib/auth'
import { useCredits } from '@/features/credits/hooks/use-credits'
import { useFrame } from '@/features/ai-video/hooks/use-frame'
import { useWorkspaceName } from '@/features/ai-video/hooks/use-workspace-name'
import { useGenerations } from '@/features/ai-video/hooks/use-generations'
import { useGenerationSelection } from '@/features/ai-video/hooks/use-generation-selection'
import { useWorkspaceDelete } from '@/features/ai-video/hooks/use-workspace-delete'
import { useFirstFrameGenerator } from '@/features/ai-video/hooks/use-first-frame-generator'
import { useLastFrameGenerator } from '@/features/ai-video/hooks/use-last-frame-generator'
import { useVideoGenerator } from '@/features/ai-video/hooks/use-video-generator'
import { useUserImages } from '@/features/user-images'

interface UseVideoWorkspacePageOptions {
  workspaceId: string
  generationId: string | undefined
  navigate: (opts: { to: string }) => void
  onDeleted?: () => void
}

export function useVideoWorkspacePage({
  workspaceId,
  generationId,
  navigate,
  onDeleted,
}: UseVideoWorkspacePageOptions) {
  const { session } = useAuth()
  const accessToken = session?.access_token
  const userId = session?.user.id
  const credits = useCredits()
  const userImages = useUserImages(userId)

  const wsName = useWorkspaceName(workspaceId, accessToken)

  const wsDelete = useWorkspaceDelete({
    workspaceId,
    accessToken,
    navigate,
    onDeleted,
  })

  // Frame hooks first (no dependency on generators)
  const firstFrame = useFrame({
    accessToken,
    shouldPoll: false,
  })

  const lastFrame = useFrame({
    accessToken,
    shouldPoll: true,
  })

  const gens = useGenerations(workspaceId, accessToken)

  const selection = useGenerationSelection({
    workspaceId,
    accessToken,
    onMoved: gens.removeByIds,
  })

  const firstFrameGen = useFirstFrameGenerator({
    accessToken,
    firstFrame,
    onResetDownstream: () => lastFrame.reset(),
  })

  const lastFrameGen = useLastFrameGenerator({
    accessToken,
    firstFrame,
    lastFrame,
    workspaceId,
    addGeneration: gens.addGeneration,
  })

  const videoGen = useVideoGenerator({
    accessToken,
    credits,
    firstFrame,
    lastFrame,
    workspaceId,
    generations: gens.generations,
    addGeneration: gens.addGeneration,
    updateGenerationRecord: gens.updateGeneration,
  })

  // Auto-load generation from deep link
  const autoLoadedRef = useRef(false)
  useEffect(() => {
    if (autoLoadedRef.current || !generationId || gens.generations.length === 0)
      return
    const gen = gens.generations.find((g) => g.id === generationId)
    if (!gen) return
    autoLoadedRef.current = true
    handleLoadGeneration(gen)
  }, [generationId, gens.generations])

  function resetAllState() {
    firstFrame.reset()
    lastFrame.reset()
    lastFrameGen.resetLastFrameState()
  }

  function handleLoadGeneration(gen: Generation) {
    if (gen.firstFrame) {
      firstFrame.setCompleted(gen.firstFrame.url ?? '', gen.firstFrame.id)
    }
    if (gen.lastFrame) {
      lastFrame.setCompleted(gen.lastFrame.url ?? '', gen.lastFrame.id)
    }
    if (gen.videoPrompt) {
      videoGen.setVideoSettings((prev) => ({
        ...prev,
        prompt: gen.videoPrompt ?? '',
      }))
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

  function handleLastFrameCompleted(updatedGen: Generation) {
    if (
      firstFrame.recordId &&
      updatedGen.firstFrame?.id === firstFrame.recordId &&
      updatedGen.lastFrame?.url
    ) {
      lastFrame.setCompleted(updatedGen.lastFrame.url, updatedGen.lastFrame.id)
    }
  }

  return {
    accessToken,
    credits,
    wsName,
    wsDelete,
    firstFrame,
    lastFrame,
    firstFrameGen,
    lastFrameGen,
    videoGen,
    gens,
    selection,
    userImages,
    resetAllState,
    handleLoadGeneration,
    handleContinueGeneration,
    handleDeleteGeneration,
    handleLastFrameCompleted,
  }
}
