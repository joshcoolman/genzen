'use client'

import { useCallback, useEffect, useRef } from 'react'
import { saveCanvas } from '../_lib/persistence'
import type { CanvasGroup, CanvasImage, Transform } from '../_lib/types'

interface UseAutosaveArgs {
  canvasId: string
  images: Array<CanvasImage>
  groups: Array<CanvasGroup>
  transform: Transform
  iRef: React.RefObject<Array<CanvasImage>>
  gRef: React.RefObject<Array<CanvasGroup>>
  tRef: React.RefObject<Transform>
}

const SAVE_DEBOUNCE_MS = 500

/** Persist positions, viewport and groupings -- never membership.
 *
 *  Inferring membership from this state is what the diff-based `syncCanvasFlags`
 *  did, and it could evict a generation whose row was written while the tab sat
 *  in the background (#212).
 *
 *  The debounce flushes on unmount and on page hide, so a navigation or a tab
 *  close inside the 500ms window cannot lose the last drag. */
export function useAutosave({
  canvasId,
  images,
  groups,
  transform,
  iRef,
  gRef,
  tRef,
}: UseAutosaveArgs) {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flushSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    void saveCanvas(canvasId, {
      images: iRef.current,
      transform: tRef.current,
      groups: gRef.current,
    })
  }, [canvasId, iRef, gRef, tRef])

  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      void saveCanvas(canvasId, { images, transform, groups })
    }, SAVE_DEBOUNCE_MS)
  }, [images, transform, groups, canvasId])

  useEffect(() => {
    const onHide = () => flushSave()
    const onVis = () => {
      if (document.visibilityState === 'hidden') flushSave()
    }
    window.addEventListener('pagehide', onHide)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('pagehide', onHide)
      document.removeEventListener('visibilitychange', onVis)
      flushSave()
    }
  }, [flushSave])

  return { flushSave }
}
