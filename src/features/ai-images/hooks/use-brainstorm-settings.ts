import { useEffect, useState } from 'react'
import {
  BRAINSTORM_DEFAULT_IMAGES_PER_PROMPT,
  BRAINSTORM_DEFAULT_ROWS,
  BRAINSTORM_IMAGES_PER_PROMPT_KEY,
  BRAINSTORM_MAX_IMAGES_PER_PROMPT,
  BRAINSTORM_MAX_ROWS,
  BRAINSTORM_REFINE_MODEL_KEY,
  BRAINSTORM_ROW_COUNT_KEY,
  DEFAULT_REFINE_MODEL,
} from '@/features/ai-images/constants'

export function useBrainstormSettings() {
  const [rowCount, setRowCount] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(BRAINSTORM_ROW_COUNT_KEY)
      if (stored) {
        const n = parseInt(stored, 10)
        if (!isNaN(n) && n >= 1 && n <= BRAINSTORM_MAX_ROWS) return n
      }
    }
    return BRAINSTORM_DEFAULT_ROWS
  })

  const [refineModel, setRefineModel] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(BRAINSTORM_REFINE_MODEL_KEY)
      if (stored) return stored
    }
    return DEFAULT_REFINE_MODEL
  })

  const [imagesPerPrompt, setImagesPerPrompt] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(BRAINSTORM_IMAGES_PER_PROMPT_KEY)
      if (stored) {
        const n = parseInt(stored, 10)
        if (n === 1 || n === 2) return n
      }
    }
    return BRAINSTORM_DEFAULT_IMAGES_PER_PROMPT
  })

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(BRAINSTORM_ROW_COUNT_KEY, String(rowCount))
    }
  }, [rowCount])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        BRAINSTORM_IMAGES_PER_PROMPT_KEY,
        String(imagesPerPrompt),
      )
    }
  }, [imagesPerPrompt])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(BRAINSTORM_REFINE_MODEL_KEY, refineModel)
    }
  }, [refineModel])

  return {
    rowCount,
    setRowCount: (n: number) =>
      setRowCount(Math.max(1, Math.min(BRAINSTORM_MAX_ROWS, n))),
    imagesPerPrompt,
    setImagesPerPrompt: (n: number) =>
      setImagesPerPrompt(
        Math.max(1, Math.min(BRAINSTORM_MAX_IMAGES_PER_PROMPT, n)),
      ),
    refineModel,
    setRefineModel,
  }
}
