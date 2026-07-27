'use client'

import { useCallback, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import type { ADContextImage } from '#/features/ad/context/ad-context'
import { ADContext, buildSystemPrompt } from '#/features/ad/context/ad-context'

export function ADContextProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const route = pathname
  const [featureContexts, setFeatureContexts] = useState<Map<string, string>>(
    () => new Map(),
  )
  const [contextImages, setContextImages] = useState<
    Map<string, ADContextImage>
  >(() => new Map())
  const register = useCallback((key: string, summary: string) => {
    setFeatureContexts((prev) => {
      if (prev.get(key) === summary) return prev
      const next = new Map(prev)
      next.set(key, summary)
      return next
    })
  }, [])

  const unregister = useCallback((key: string) => {
    setFeatureContexts((prev) => {
      if (!prev.has(key)) return prev
      const next = new Map(prev)
      next.delete(key)
      return next
    })
  }, [])

  const registerImage = useCallback((key: string, image: ADContextImage) => {
    setContextImages((prev) => {
      if (
        prev.get(key)?.base64 === image.base64 &&
        prev.get(key)?.mediaType === image.mediaType
      )
        return prev
      const next = new Map(prev)
      next.set(key, image)
      return next
    })
  }, [])

  const unregisterImage = useCallback((key: string) => {
    setContextImages((prev) => {
      if (!prev.has(key)) return prev
      const next = new Map(prev)
      next.delete(key)
      return next
    })
  }, [])

  const systemPrompt = useMemo(
    () => buildSystemPrompt(route, featureContexts),
    [route, featureContexts],
  )

  const value = useMemo(
    () => ({
      route,
      featureContexts,
      register,
      unregister,
      systemPrompt,
      contextImages,
      registerImage,
      unregisterImage,
    }),
    [
      route,
      featureContexts,
      register,
      unregister,
      systemPrompt,
      contextImages,
      registerImage,
      unregisterImage,
    ],
  )

  return <ADContext.Provider value={value}>{children}</ADContext.Provider>
}
