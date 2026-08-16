'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { generateVideo, listVideos } from './_actions/generate-video.action'
import {
  DEFAULT_VIDEO_MODEL,
  aspectRatiosFor,
  estimateCostCents,
  supportsEndImage,
  videoModelBySlug,
  videoModelsByPrice,
} from './models'
import type { VideoRecord } from './_actions/generate-video.action'
import { deleteGalleryImage } from '#/features/ai-images/server/gallery.action'
import { useGenerationPoll } from '#/features/ai-images/hooks/use-generation-poll'
import { useUserImages } from '#/features/user-images/hooks/use-user-images'
import { useAuth } from '#/lib/auth'
import { imageUrl } from '#/lib/image-url'
import { usePersistedState } from '#/lib/use-persisted-state'
import { toast } from '#/components'

/** One key, one value: which model the picker is on. */
const MODEL_KEY = 'genzen:video:model'

/** What the strip renders and the submit sends. One, not a set: this model
 *  takes a single first frame. */
export interface SourceImage {
  id: string
  url: string
  title: string
}

/**
 * The state `view.tsx` renders.
 *
 * The first read of the clip list is the server component's, so there is no
 * loading state and no empty first paint. After that a 5s poll is the only
 * update signal -- nothing pushes, exactly as the gallery works: each tick asks
 * FAL whether anything settled and then re-reads the list.
 *
 * The library comes from `useUserImages`, the same hook the generator panel
 * uses, so the picker here is the picker there.
 */
export function useView(initialVideos: Array<VideoRecord>) {
  const { user } = useAuth()
  const searchParams = useSearchParams()

  // Single-select, and deliberately (#385): a clip is 20-100x the price of a
  // still, so the image panel's "tick four models and fire" would be $20 a
  // click here. `videoModelBySlug` is what makes a stored slug for a model that
  // has since been dropped fall back rather than crash.
  const [modelSlug, setModelSlug, modelHydrated] = usePersistedState(
    () => localStorage.getItem(MODEL_KEY) ?? DEFAULT_VIDEO_MODEL.slug,
    DEFAULT_VIDEO_MODEL.slug,
  )
  const model = videoModelBySlug(modelSlug) ?? DEFAULT_VIDEO_MODEL

  useEffect(() => {
    // Waits on `hydrated`, or the fallback lands on top of the stored value on
    // mount and the setting resets on every page load.
    if (modelHydrated) localStorage.setItem(MODEL_KEY, model.slug)
  }, [modelHydrated, model.slug])

  // Cheapest first, and stable across renders so the picker's rows are not a
  // new array on every keystroke in the prompt box.
  const pickerModels = useMemo(() => videoModelsByPrice(), [])

  const userImages = useUserImages(user.id)

  const [videos, setVideos] = useState(initialVideos)
  // A list, not a field: one first frame can carry several takes, and queueing
  // them is cheaper than sitting through one before writing the next. Same
  // component the generator panel uses.
  const [prompts, setPrompts] = useState<Array<string>>([''])
  const [duration, setDuration] = useState(model.defaultDuration)
  // Seeded for the mode the route opens in (no first frame -> no `auto`).
  const [aspectRatio, setAspectRatio] = useState(
    aspectRatiosFor(model, false)[0],
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  // One picker, two slots. A second dialog would be the same component mounted
  // twice to answer the same question; the target says where the pick lands.
  const [pickerTarget, setPickerTarget] = useState<'first' | 'last' | null>(
    null,
  )

  // The set is one image, held as an array so `RefImageStrip` can render it
  // unchanged. Anything past the first is dropped rather than queued -- the
  // endpoint takes a single `image_url`.
  const [sources, setSources] = useState<Array<SourceImage>>([])
  // Optional. With one, the model solves the move between the two stills
  // rather than inventing where the shot goes -- the same instruction a prompt
  // spends three sentences failing to pin down.
  const [endSources, setEndSources] = useState<Array<SourceImage>>([])

  // `?image=<id>` is how Animate hands a card over. It resolves once the
  // library has loaded, because the strip needs a URL and a title, not just an
  // id.
  const handoffId = searchParams.get('image')
  useEffect(() => {
    if (!handoffId || sources.length > 0 || userImages.isLoading) return
    const match = userImages.images.find((image) => image.id === handoffId)
    if (match) {
      setSources([
        {
          id: match.id,
          url: userImages.imageUrls[match.id] ?? imageUrl(match.id, 'thumb'),
          title: match.title,
        },
      ])
    }
  }, [handoffId, sources.length, userImages])

  // The oldest clip still rendering, which is what paces the poll (#327). A
  // clip is minutes of work, so its deadline is longer than a still's -- that
  // part lives in the action.
  const pendingSince = useMemo(
    () =>
      videos
        .filter((video) => video.status === 'pending')
        .reduce<
          string | null
        >((oldest, video) => (!oldest || video.created_at < oldest ? video.created_at : oldest), null),
    [videos],
  )

  const refresh = useCallback(async () => {
    try {
      setVideos(await listVideos())
    } catch {
      // A failed poll is not worth a toast -- the next tick re-reads.
    }
  }, [])

  useGenerationPoll(pendingSince, refresh)

  /**
   * Bin a clip. `deleteGalleryImage` is the gallery's own delete, unchanged: a
   * clip is a `user_images` row like any other, so the three outcomes it
   * already decides between are the three this route wants -- a generating clip
   * is cancelled at FAL first, a generating or failed row goes outright because
   * Trash has nothing to offer for a clip that does not exist, and a finished
   * one soft-deletes into Trash, which is already listing them (#305).
   *
   * The card leaves on the click and a failure re-reads, rather than this hook
   * remembering what it removed -- the same trade the gallery makes.
   */
  const deleteVideo = useCallback(
    async (id: string) => {
      setVideos((current) => current.filter((video) => video.id !== id))
      try {
        await deleteGalleryImage(id)
      } catch {
        toast.error('Could not delete that clip')
        await refresh()
      }
    },
    [refresh],
  )

  const openPicker = useCallback(
    (target: 'first' | 'last') => {
      void userImages.refresh()
      setPickerTarget(target)
    },
    [userImages],
  )

  const collectSources = useCallback(
    (picked: Array<SourceImage>) => {
      // `max={1}` already bounds the picker; this is the belt to that brace.
      const one = picked.slice(0, 1)
      if (pickerTarget === 'last') setEndSources(one)
      else setSources(one)
    },
    [pickerTarget],
  )

  const clearSources = useCallback(() => setSources([]), [])
  const clearEndSources = useCallback(() => setEndSources([]), [])

  const updatePrompt = useCallback((index: number, value: string) => {
    setPrompts((current) => current.map((p, i) => (i === index ? value : p)))
  }, [])

  const addPrompt = useCallback(() => {
    setPrompts((current) => [...current, ''])
  }, [])

  const removePrompt = useCallback((index: number) => {
    // Never empty: the list is the input, so removing the last row leaves a
    // blank one rather than nothing to type in.
    setPrompts((current) =>
      current.length <= 1 ? [''] : current.filter((_, i) => i !== index),
    )
  }, [])

  const clearPrompts = useCallback(() => setPrompts(['']), [])

  const filledPrompts = useMemo(
    () => prompts.map((p) => p.trim()).filter((p) => p.length > 0),
    [prompts],
  )

  const sourceId = sources.at(0)?.id ?? null
  const endImageId = endSources.at(0)?.id ?? null
  const hasFirstFrame = !!sourceId
  const hasLastFrame = !!endImageId

  // The options change with the mode *and* with the model, so a value carried
  // across either switch can be one the endpoint rejects -- `auto` has nothing
  // to match once the first frame is cleared, and H3's image endpoint has no
  // aspect param at all. Coerced here rather than validated at submit, so the
  // control never shows a selection the request would refuse. An empty list is
  // the "no control" case: the form renders nothing and the submit sends
  // nothing, so there is no value to coerce to.
  const aspectOptions = useMemo(
    () => aspectRatiosFor(model, hasFirstFrame, hasLastFrame),
    [model, hasFirstFrame, hasLastFrame],
  )
  useEffect(() => {
    if (aspectOptions.length > 0 && !aspectOptions.includes(aspectRatio)) {
      setAspectRatio(aspectOptions[0])
    }
  }, [aspectOptions, aspectRatio])

  // Same coercion, for the same reason: the durations are the model's, and
  // switching from LTX (6s up) to H3 (5s up) leaves 18s selected against a
  // model whose ceiling is 15.
  useEffect(() => {
    if (!model.durations.includes(duration)) setDuration(model.defaultDuration)
  }, [model, duration])

  // A model that takes no end frame in any mode should not offer the slot --
  // and anything staged in it goes, rather than being silently dropped at
  // submit.
  const modelTakesEndFrame = supportsEndImage(model)
  useEffect(() => {
    if (!modelTakesEndFrame && endSources.length > 0) setEndSources([])
  }, [modelTakesEndFrame, endSources.length])

  // An end frame needs a start. Dropping it on clear beats sending a request
  // the action would refuse.
  useEffect(() => {
    if (!hasFirstFrame && endSources.length > 0) setEndSources([])
  }, [hasFirstFrame, endSources.length])
  // Every prompt is its own clip, so the figure on the button multiplies. The
  // per-clip price is constant; what varies is how many are queued.
  const estimatedCost =
    estimateCostCents(model, duration) * Math.max(filledPrompts.length, 1)
  // The prompt is the only requirement: with no first frame the model invents
  // the whole shot.
  const canSubmit = filledPrompts.length > 0 && !isSubmitting

  const submit = useCallback(async () => {
    if (filledPrompts.length === 0) return

    setIsSubmitting(true)
    try {
      // Sequential, not `Promise.all`: each call reserves a row before it
      // contacts FAL, and firing them together would interleave the
      // reservations against a queue that answers in its own order. Sorting
      // the list out is not worth the few hundred milliseconds saved.
      for (const prompt of filledPrompts) {
        await generateVideo({
          ...(sourceId ? { imageId: sourceId } : {}),
          ...(endImageId ? { endImageId } : {}),
          prompt,
          duration,
          aspectRatio,
          modelSlug: model.slug,
        })
      }
      // Refresh once so the pending cards appear; the poll takes it from here.
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setIsSubmitting(false)
    }
  }, [
    sourceId,
    endImageId,
    filledPrompts,
    duration,
    aspectRatio,
    model.slug,
    refresh,
  ])

  return {
    model,
    models: pickerModels,
    selectModel: setModelSlug,
    modelTakesEndFrame,
    aspectOptions,
    hasFirstFrame,
    userImages,
    sources,
    endSources,
    pickerTarget,
    setPickerTarget,
    openPicker,
    collectSources,
    clearSources,
    clearEndSources,
    videos,
    deleteVideo,
    prompts,
    updatePrompt,
    addPrompt,
    removePrompt,
    clearPrompts,
    pendingCount: filledPrompts.length,
    duration,
    setDuration,
    aspectRatio,
    setAspectRatio,
    estimatedCost,
    isSubmitting,
    canSubmit,
    submit,
  }
}
