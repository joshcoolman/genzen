import { useState } from 'react'
import type { SavedAiImage } from '@/features/ai-images/types'
import type { CreditsState } from '@/features/credits/hooks/use-credits'
import { editImage } from '@/features/ai-images/server/edit-image.server'
import { CREDIT_COSTS } from '@/features/credits'
import {
  flipOrientation,
  getRatioOptions,
} from '@/features/ai-images/constants'
import { DEFAULT_EDIT_MODEL } from '@/features/ai-images/models'

interface UseEditorOptions {
  accessToken: string | undefined
  credits: CreditsState
  defaultOrientation: 'landscape' | 'portrait'
  defaultAspectRatio: string
  setError: (error: string | null) => void
}

export interface EditorState {
  editTarget: SavedAiImage | null
  editPrompt: string
  editLoading: boolean
  editOrientation: 'landscape' | 'portrait'
  editAspectRatio: string
  editModelId: string
  ratioOptions: Array<string>
  setEditPrompt: (prompt: string) => void
  setEditAspectRatio: (ratio: string) => void
  setEditModelId: (modelId: string) => void
  openEditor: (img: SavedAiImage) => void
  closeEditor: () => void
  handleEditOrientationToggle: () => void
  handleEditSubmit: () => Promise<void>
}

export function useEditor({
  accessToken,
  credits,
  defaultOrientation,
  defaultAspectRatio,
  setError,
}: UseEditorOptions): EditorState {
  const [editTarget, setEditTarget] = useState<SavedAiImage | null>(null)
  const [editPrompt, setEditPrompt] = useState('')
  const [editLoading, setEditLoading] = useState(false)
  const [editOrientation, setEditOrientation] = useState<
    'landscape' | 'portrait'
  >(defaultOrientation)
  const [editAspectRatio, setEditAspectRatio] = useState(defaultAspectRatio)
  const [editModelId, setEditModelId] = useState(DEFAULT_EDIT_MODEL)

  const ratioOptions = getRatioOptions(editOrientation)

  function openEditor(img: SavedAiImage) {
    setEditTarget(img)
    setEditPrompt('')
    const srcRatio = img.generation_metadata?.aspect_ratio as string | undefined
    if (srcRatio) {
      const [a, b] = srcRatio.split(':').map(Number)
      const isLandscape = a >= b
      setEditOrientation(isLandscape ? 'landscape' : 'portrait')
      setEditAspectRatio(srcRatio)
    } else {
      setEditOrientation(defaultOrientation)
      setEditAspectRatio(defaultAspectRatio)
    }
  }

  function closeEditor() {
    setEditTarget(null)
    setEditPrompt('')
  }

  function handleEditOrientationToggle() {
    const flipped = flipOrientation(editOrientation, editAspectRatio)
    setEditOrientation(flipped.orientation)
    setEditAspectRatio(flipped.aspectRatio)
  }

  async function handleEditSubmit() {
    if (!editTarget || !editPrompt.trim() || !accessToken) return
    setEditLoading(true)
    try {
      await credits.deduct(CREDIT_COSTS.edit, 'edit')
      await editImage({
        data: {
          accessToken,
          sourceImageId: editTarget.id,
          editPrompt: editPrompt.trim(),
          aspectRatio: editAspectRatio,
          editModelId,
        },
      })
      setEditTarget(null)
      setEditPrompt('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to edit image')
      setEditTarget(null)
    } finally {
      setEditLoading(false)
    }
  }

  return {
    editTarget,
    editPrompt,
    editLoading,
    editOrientation,
    editAspectRatio,
    editModelId,
    ratioOptions,
    setEditPrompt,
    setEditAspectRatio,
    setEditModelId,
    openEditor,
    closeEditor,
    handleEditOrientationToggle,
    handleEditSubmit,
  }
}
