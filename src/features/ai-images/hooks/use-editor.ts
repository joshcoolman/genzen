import { useState } from 'react'
import type { SavedAiImage } from '@/features/ai-images/types'
import type { CreditsState } from '@/features/credits/hooks/use-credits'
import { editImage } from '@/features/ai-images/server/edit-image.server'
import { CREDIT_COSTS } from '@/features/credits'
import {
  detectAspectRatio,
  getRatioOptions,
} from '@/features/ai-images/constants'
import { DEFAULT_EDIT_MODEL } from '@/features/ai-images/models'

interface UseEditorOptions {
  accessToken: string | undefined
  credits: CreditsState
  defaultOrientation: 'landscape' | 'portrait'
  defaultAspectRatio: string
  imageUrls: Record<string, string>
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
  referenceImageIds: Array<string>
  setEditPrompt: (prompt: string) => void
  setEditAspectRatio: (ratio: string) => void
  setEditModelId: (modelId: string) => void
  addReferenceImage: (id: string) => void
  removeReferenceImage: (id: string) => void
  openEditor: (img: SavedAiImage) => void
  closeEditor: () => void
  setEditOrientation: (o: 'landscape' | 'portrait') => void
  handleEditSubmit: () => Promise<void>
}

export function useEditor({
  accessToken,
  credits,
  defaultOrientation,
  defaultAspectRatio,
  imageUrls,
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
  const [referenceImageIds, setReferenceImageIds] = useState<Array<string>>([])

  const ratioOptions = getRatioOptions(editOrientation)

  function addReferenceImage(id: string) {
    setReferenceImageIds((prev) =>
      prev.includes(id) || prev.length >= 4 ? prev : [...prev, id],
    )
  }

  function removeReferenceImage(id: string) {
    setReferenceImageIds((prev) => prev.filter((x) => x !== id))
  }

  function applyRatio(ratio: string) {
    const [a, b] = ratio.split(':').map(Number)
    const isLandscape = a >= b
    setEditOrientation(isLandscape ? 'landscape' : 'portrait')
    setEditAspectRatio(ratio)
  }

  function openEditor(img: SavedAiImage) {
    setEditTarget(img)
    setEditPrompt('')
    setReferenceImageIds([])
    const srcRatio = img.generation_metadata?.aspect_ratio
    if (srcRatio) {
      applyRatio(srcRatio)
    } else {
      // Detect from actual image dimensions
      const url = imageUrls[img.id]
      if (url) {
        const probe = new Image()
        probe.onload = () => {
          applyRatio(detectAspectRatio(probe.naturalWidth, probe.naturalHeight))
        }
        probe.src = url
      } else {
        setEditOrientation(defaultOrientation)
        setEditAspectRatio(defaultAspectRatio)
      }
    }
  }

  function closeEditor() {
    setEditTarget(null)
    setEditPrompt('')
    setReferenceImageIds([])
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
          referenceImageIds:
            referenceImageIds.length > 0 ? referenceImageIds : undefined,
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
    referenceImageIds,
    setEditPrompt,
    setEditAspectRatio,
    setEditModelId,
    addReferenceImage,
    removeReferenceImage,
    openEditor,
    closeEditor,
    setEditOrientation,
    handleEditSubmit,
  }
}
