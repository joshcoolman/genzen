'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { generateVideo, listVideos } from './_actions/generate-video.action'
import type { VideoRecord } from './_actions/generate-video.action'
import {
  DEFAULT_VIDEO_MODEL,
  aspectRatiosFor,
  estimateCostCents,
  resolutionsFor,
  supportsEndImage,
  takesFirstFrame,
  videoModelBySlug,
  videoModelsByPrice,
} from '#/features/video/models'
import { deleteGalleryImage } from '#/features/ai-images/server/gallery.action'
import { useGenerationPoll } from '#/features/ai-images/hooks/use-generation-poll'
import { saveFileToLibrary } from '#/features/user-images/lib/save-to-library'
import { useUserImages } from '#/features/user-images/hooks/use-user-images'
import { captureLastFrame } from '#/features/video/frame-capture'
import { stampFrameSource } from '#/features/video/server/stamp-frame.action'
import { useAuth } from '#/lib/auth'
import { imageUrl } from '#/lib/image-url'
import { usePersistedState } from '#/lib/use-persisted-state'
import { toast } from '#/components'

/** Which model the picker is on. One slug; see `readSlug`. */
const MODEL_KEY = 'genzen:video:model'

/**
 * Above this much, Generate asks first.
 *
 * A count threshold is what Images uses, and it is the wrong instrument here:
 * two Flux 3 clips at 20s is $6.80 and eight LTX clips at 6s is $4.32, so the
 * number of clips says little about the size of the click. Money is the thing
 * being risked, so money is the trigger.
 */
const CONFIRM_ABOVE_CENTS = 500

/**
 * The stored slug, tolerating both shapes this key has held.
 *
 * A bare slug before #417 (`"flux-3"`), a JSON array during it
 * (`["flux-3","ltx-2.5-fast"]`), and a bare slug again now. Anyone who used
 * the route has one of the first two, and neither may throw on mount -- so a
 * stored array collapses to its first entry rather than resetting the choice,
 * and an unparseable value is read as the bare slug it used to be.
 */
function readSlug(): string {
  const raw = localStorage.getItem(MODEL_KEY)
  if (!raw) return DEFAULT_VIDEO_MODEL.slug
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed === 'string') return parsed
    if (Array.isArray(parsed)) {
      const first = parsed.find((v) => typeof v === 'string')
      if (first) return first
    }
  } catch {
    // Not JSON: the pre-#417 bare slug.
  }
  return raw
}

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

  // **One model.** Multi-select (#417) bought a cross-model comparison and
  // paid for it by intersecting every control down to what all the ticked
  // models agreed on -- see the lineup's header comment. On video the models
  // disagree about nearly everything, so the form could only ever offer the
  // common denominator, and the differences between the models became the one
  // thing it could not express. Comparing serially costs a second submit;
  // that is cheaper than a form that cannot reach what a model can do.
  const [modelSlug, setModelSlug, modelHydrated] = usePersistedState(
    readSlug,
    DEFAULT_VIDEO_MODEL.slug,
  )

  // Resolved through the lineup, so a stored slug for a model that has since
  // been dropped falls out rather than crashing. Cheapest first, matching the
  // picker, so the estimate and the list agree on order.
  // Resolved through the lineup, so a stored slug for a model that has since
  // been dropped falls back rather than crashing. Never null: the form always
  // has a model, and `canSubmit` gates on the prompt instead.
  const model = useMemo(
    () => videoModelBySlug(modelSlug) ?? DEFAULT_VIDEO_MODEL,
    [modelSlug],
  )

  useEffect(() => {
    // Waits on `hydrated`, or the fallback lands on top of the stored value on
    // mount and the setting resets on every page load.
    if (modelHydrated)
      localStorage.setItem(MODEL_KEY, JSON.stringify(modelSlug))
  }, [modelHydrated, modelSlug])

  const selectModel = useCallback(
    (slug: string) => setModelSlug(slug),
    [setModelSlug],
  )

  // Cheapest first, and stable across renders so the picker's rows are not a
  // new array on every keystroke in the prompt box.
  const pickerModels = useMemo(() => videoModelsByPrice(), [])

  const userImages = useUserImages(user.id)

  const [videos, setVideos] = useState(initialVideos)
  // A list, not a field: one first frame can carry several takes, and queueing
  // them is cheaper than sitting through one before writing the next. Same
  // component the generator panel uses.
  const [prompts, setPrompts] = useState<Array<string>>([''])
  const [duration, setDuration] = useState(DEFAULT_VIDEO_MODEL.defaultDuration)
  // Seeded for the mode the route opens in (no first frame -> no `auto`).
  const [aspectRatio, setAspectRatio] = useState(
    aspectRatiosFor(DEFAULT_VIDEO_MODEL, false)[0],
  )
  // Only meaningful for a model with tiers; for the rest the submit sends the
  // model's fixed `resolution` and this is never read.
  const [resolution, setResolution] = useState(DEFAULT_VIDEO_MODEL.resolution)
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

  // `?image=<id>` pre-loads the first frame from a library row. It was how
  // Images' `Animate` menu item handed a card over; that item is gone, so
  // nothing in the app links here today and the parameter is kept as the
  // route's front door for a still -- it costs one effect and it is what any
  // future handoff would use. It resolves once the library has loaded, because
  // the strip needs a URL and a title, not just an id.
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

  /**
   * Carry on from a clip you like: its last frame becomes the next first frame
   * (#494).
   *
   * The five manual steps this replaces all worked -- generate, open
   * `lab/frames`, scrub to the end, extract, come back and pick the frame --
   * which is exactly why it was worth collapsing: nothing was broken, it was
   * just enough friction that a four-clip sequence did not get made.
   *
   * **It sets up the next generation and stops.** No auto-run.
   *
   * **The prompt comes with it, and it used to be cleared.** The reasoning for
   * clearing was that the frame is the continuity and the words are about what
   * happens next, which is a different sentence every time. True of the
   * sentence, wrong about the work: continuing is usually the same shot carried
   * on, so most of that sentence is the one that made the clip you are
   * continuing from, and starting from empty meant retyping it to change a
   * clause. It arrives editable, not locked.
   *
   * An end frame from the previous run is still dropped -- it described where
   * the last clip was going, not this one, and unlike the prompt there is no
   * part of it to edit.
   *
   * The frame is saved as an ordinary upload, the same classification
   * `lab/frames` gives it: it was not generated by a model, it was cut out of
   * something that was. So it lands in Images, and the library is re-read
   * because the picker's list is what the strip resolves against.
   */
  const [isContinuing, setIsContinuing] = useState<string | null>(null)

  const continueFrom = useCallback(
    async (video: VideoRecord) => {
      setIsContinuing(video.id)
      try {
        const { blob, timeSeconds } = await captureLastFrame(`/img/${video.id}`)

        const image = await saveFileToLibrary({
          userId: user.id,
          file: new File([blob], `frame-${video.id}-end.png`, {
            type: 'image/png',
          }),
          title: `Frame \u00b7 ${video.title}`,
          description: video.description,
        })

        // Best effort: a frame without its origin stamped is still a usable
        // first frame, so a failure here must not lose the extraction.
        void stampFrameSource({
          imageId: image.id,
          clipId: video.id,
          timeSeconds,
        }).catch(() => {})

        setSources([
          {
            id: image.id,
            url: imageUrl(image.id, 'thumb'),
            title: image.title,
          },
        ])
        setEndSources([])
        /* The clip's own prompt, not an empty box. Continuing is usually the
           same shot carried on, so what you want in front of you is what made
           the clip you are continuing from -- edited, not retyped. It cleared
           the prompt until now, which made the commonest case the most work. */
        setPrompts([video.description ?? ''])
        void userImages.refresh()
      } catch (err) {
        toast.error(
          err instanceof Error && err.message
            ? err.message
            : 'Could not read the last frame of that clip',
        )
      } finally {
        setIsContinuing(null)
      }
    },
    [user.id, userImages],
  )

  const filledPrompts = useMemo(
    () => prompts.map((p) => p.trim()).filter((p) => p.length > 0),
    [prompts],
  )

  const sourceId = sources.at(0)?.id ?? null
  const endImageId = endSources.at(0)?.id ?? null
  const hasFirstFrame = !!sourceId
  const hasLastFrame = !!endImageId

  // **Whether a staged frame reaches this model at all.** h3-max is
  // text-to-video only, and a frame staged before the switch is kept rather
  // than cleared -- switching back should not cost the person the pick. It is
  // simply not sent, and the form hides the slots so nothing on screen claims
  // otherwise.
  const modelTakesFirstFrame = takesFirstFrame(model)
  const sendsFirstFrame = hasFirstFrame && modelTakesFirstFrame
  const sendsLastFrame = hasLastFrame && modelTakesFirstFrame

  // The options change with the mode *and* with the model, so a value carried
  // across either switch can be one the endpoint rejects -- `auto` has nothing
  // to match once the first frame is cleared, and H3's image endpoint has no
  // aspect param at all. Coerced here rather than validated at submit, so the
  // control never shows a selection the request would refuse. An empty list is
  // the "no control" case: the form renders nothing and the submit sends
  // nothing, so there is no value to coerce to.
  const aspectOptions = useMemo(
    () => aspectRatiosFor(model, sendsFirstFrame, sendsLastFrame),
    [model, sendsFirstFrame, sendsLastFrame],
  )
  useEffect(() => {
    if (aspectOptions.length > 0 && !aspectOptions.includes(aspectRatio)) {
      setAspectRatio(aspectOptions[0])
    }
  }, [aspectOptions, aspectRatio])

  // Same coercion, for the same reason: switching from LTX (6-20) to H3
  // (5-15) leaves 18s selected against a model whose ceiling is 15.
  const durationOptions = model.durations
  useEffect(() => {
    if (!durationOptions.includes(duration)) {
      setDuration(model.defaultDuration)
    }
  }, [durationOptions, duration, model])

  // Only where the model offers a choice; empty is "no control", and the
  // submit sends the model's fixed `resolution` instead. This is the first
  // control that exists for one model and not the others, which is the whole
  // point of dropping multi-select -- an intersection would have deleted it.
  const resolutionOptions = useMemo(() => resolutionsFor(model), [model])
  useEffect(() => {
    if (resolutionOptions.length === 0) return
    if (!resolutionOptions.some((r) => r.id === resolution)) {
      setResolution(model.resolution)
    }
  }, [resolutionOptions, resolution, model])

  const modelTakesEndFrame = supportsEndImage(model)
  useEffect(() => {
    if (!modelTakesEndFrame && endSources.length > 0) setEndSources([])
  }, [modelTakesEndFrame, endSources.length])

  // An end frame needs a start. Dropping it on clear beats sending a request
  // the action would refuse.
  useEffect(() => {
    if (!hasFirstFrame && endSources.length > 0) setEndSources([])
  }, [hasFirstFrame, endSources.length])

  // One clip per prompt, one model. The count is the prompt list.
  const clipCount = Math.max(filledPrompts.length, 1)
  const estimatedCost =
    estimateCostCents(model, duration, resolution) * clipCount
  // A prompt. With no first frame the model invents the whole shot, so the
  // frames stay optional.
  const canSubmit = filledPrompts.length > 0 && !isSubmitting
  /** Above this the form asks first -- see `CONFIRM_ABOVE_CENTS`. */
  const needsConfirm = estimatedCost > CONFIRM_ABOVE_CENTS

  const submit = useCallback(async () => {
    if (filledPrompts.length === 0) return

    setIsSubmitting(true)
    try {
      // Sequential, not `Promise.all`: each call reserves a row before it
      // contacts FAL, and firing them together would interleave the
      // reservations against a queue that answers in its own order. Sorting
      // the list out is not worth the few hundred milliseconds saved.
      // Prompt-major rather than model-major: the first clip of every prompt
      // arrives before the second of any, so a submit you decide to abandon
      // half way has covered the prompts rather than one prompt thoroughly.
      for (const prompt of filledPrompts) {
        await generateVideo({
          // Withheld rather than sent-and-ignored: the action records the row
          // as `text_to_video` off what it actually received, so passing a
          // frame this model never sees would mislabel the clip.
          ...(sendsFirstFrame && sourceId ? { imageId: sourceId } : {}),
          ...(sendsLastFrame && endImageId ? { endImageId } : {}),
          prompt,
          duration,
          aspectRatio,
          resolution,
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
    sendsFirstFrame,
    sendsLastFrame,
    filledPrompts,
    duration,
    aspectRatio,
    resolution,
    model,
    refresh,
  ])

  return {
    model,
    pickerModels,
    modelSlug,
    selectModel,
    durationOptions,
    modelTakesEndFrame,
    modelTakesFirstFrame,
    aspectOptions,
    resolutionOptions,
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
    continueFrom,
    isContinuing,
    prompts,
    updatePrompt,
    addPrompt,
    removePrompt,
    clearPrompts,
    pendingCount: clipCount,
    duration,
    setDuration,
    aspectRatio,
    setAspectRatio,
    resolution,
    setResolution,
    estimatedCost,
    needsConfirm,
    promptCount: Math.max(filledPrompts.length, 1),
    isSubmitting,
    canSubmit,
    submit,
  }
}
