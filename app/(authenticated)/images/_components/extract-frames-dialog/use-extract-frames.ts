'use client'

import { useRef, useState } from 'react'
import {
  detectImageFrames,
  extractImageFrames,
} from '../../_actions/extract-frames.action'
import { MAX_FRAMES, validateFrames } from '../../_lib/frame-extraction'
import type { FrameRegion, FrameReview } from '../../_lib/frame-extraction'
import type { SavedAiImage } from '#/features/ai-images/types'

export interface ReviewedFrame extends FrameRegion {
  selected: boolean
  recordId?: string
  error?: string
}
interface Options {
  onStart: (
    frames: Array<FrameRegion>,
    source: SavedAiImage,
    retry: boolean,
  ) => void
  onOutcome: (
    frameId: string,
    recordId: string | null,
    error: string | null,
  ) => void
  onSettled: () => void
}
export function useExtractFrames(options: Options) {
  const [target, setTarget] = useState<SavedAiImage | null>(null)
  const [isOpen, setOpen] = useState(false)
  const [groupId, setGroupId] = useState<string | null>(null)
  const [review, setReview] = useState<FrameReview | null>(null)
  const [frames, setFrames] = useState<Array<ReviewedFrame>>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [detecting, setDetecting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const batch = useRef('')
  const savingRef = useRef(false)

  async function open(source: SavedAiImage, restart = false) {
    if (
      savingRef.current ||
      (!restart && source.id === target?.id && (review || detecting))
    ) {
      setOpen(true)
      return
    }
    const id = crypto.randomUUID()
    batch.current = id
    setTarget(source)
    setOpen(true)
    setReview(null)
    setGroupId(null)
    setFrames([])
    setActiveId(null)
    setError(null)
    setSubmitted(false)
    setSaving(false)
    setDetecting(true)
    try {
      const result = await detectImageFrames(source.id)
      if (batch.current !== id) return
      if (!result.data) throw new Error(result.error)
      setReview(result.data)
      setFrames(result.data.frames.map((f) => ({ ...f, selected: true })))
      setActiveId(result.data.frames[0]?.id ?? null)
    } catch (reason) {
      if (batch.current === id)
        setError(
          reason instanceof Error
            ? reason.message
            : 'Detection failed. Try again.',
        )
    } finally {
      if (batch.current === id) setDetecting(false)
    }
  }
  function update(id: string, patch: Partial<ReviewedFrame>) {
    if (submitted) return
    setFrames((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  }
  function add() {
    if (!review || submitted || frames.length >= MAX_FRAMES) return
    const frame = {
      id: crypto.randomUUID(),
      label: 'Added frame',
      selected: true,
      left: 0,
      top: 0,
      width: Math.max(1, Math.round(review.width / 3)),
      height: Math.max(1, Math.round(review.height / 3)),
    }
    setFrames((prev) => [...prev, frame])
    setActiveId(frame.id)
  }
  function move(id: string, direction: number) {
    if (submitted) return
    setFrames((prev) => {
      const next = [...prev]
      const index = next.findIndex((f) => f.id === id)
      const destination = index + direction
      if (index < 0 || destination < 0 || destination >= next.length)
        return prev
      ;[next[index], next[destination]] = [next[destination], next[index]]
      return next
    })
  }
  async function save() {
    if (!review || !target || savingRef.current) return
    const chosen = frames.filter((f) => f.selected)
    try {
      validateFrames(chosen, review.width, review.height)
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Check the frame boundaries.',
      )
      return
    }
    const batchId = batch.current
    savingRef.current = true
    setSaving(true)
    setError(null)
    setSubmitted(true)
    const pending = chosen.filter((f) => !f.recordId)
    options.onStart(pending, target, submitted)
    let outcomes: Array<{
      frameId: string
      recordId: string | null
      error: string | null
    }>
    try {
      const result = await extractImageFrames({
        sourceId: review.sourceId,
        sourceHash: review.sourceHash,
        batchId,
        frames: chosen,
      })
      if (!result.data) throw new Error(result.error)
      outcomes = result.data.outcomes
      if (outcomes.some((o) => o.recordId)) setGroupId(result.data.groupId)
    } catch (reason) {
      const message =
        reason instanceof Error
          ? reason.message
          : 'Extraction failed. Try again.'
      outcomes = pending.map((f) => ({
        frameId: f.id,
        recordId: null,
        error: message,
      }))
    }
    for (const outcome of outcomes)
      if (pending.some((f) => f.id === outcome.frameId))
        options.onOutcome(outcome.frameId, outcome.recordId, outcome.error)
    options.onSettled()
    savingRef.current = false
    if (batch.current !== batchId) return
    setSaving(false)
    const byId = new Map(outcomes.map((o) => [o.frameId, o]))
    setFrames((prev) =>
      prev.map((f) => {
        const outcome = byId.get(f.id)
        return outcome
          ? {
              ...f,
              recordId: outcome.recordId ?? undefined,
              error: outcome.error ?? undefined,
            }
          : f
      }),
    )
    setError(outcomes.find((o) => o.error)?.error ?? null)
  }
  return {
    groupId,
    target,
    isOpen,
    setOpen,
    open,
    review,
    frames,
    activeId,
    setActiveId,
    detecting,
    saving,
    submitted,
    error,
    update,
    add,
    move,
    save,
  }
}
