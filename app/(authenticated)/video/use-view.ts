'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { generateVideo, listVideos } from './_actions/generate-video.action'
import type { VideoRecord } from './_actions/generate-video.action'
import type {
  GroupWrite,
  ImageGroupSummary,
} from '#/features/groups/hooks/use-groups'
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
import {
  deleteGalleryImage,
  trashGalleryImages,
} from '#/features/ai-images/server/gallery.action'
import { useGenerationPoll } from '#/features/ai-images/hooks/use-generation-poll'
import { saveFileToLibrary } from '#/features/user-images/lib/save-to-library'
import { useUserImages } from '#/features/user-images/hooks/use-user-images'
import { captureLastFrame } from '#/features/video/frame-capture'
import { stampFrameSource } from '#/features/video/server/stamp-frame.action'
import { useAuth } from '#/lib/auth'
import { imageUrl } from '#/lib/image-url'
import { usePersistedState } from '#/lib/use-persisted-state'
import { useSelection } from '#/lib/use-selection'
import { useGroups } from '#/features/groups/hooks/use-groups'
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

  const router = useRouter()

  /**
   * Groups of clips (#517), the same mechanism Images has -- promoted to
   * `src/features/groups/` when this route became its second consumer.
   *
   * `'video'` scopes the whole hook: this route sees video groups and only
   * those, and a clip can never join an image group. The namespaces are
   * disjoint by the `kind` column, for the reason `0012_group_kind.sql` gives.
   */
  const groups = useGroups('video')

  /**
   * The group being worked in lives in the URL, not in local state (#319's
   * rule, unchanged). A group is a place: it survives a reload and it can be
   * linked to. `?group=` rather than a route segment, because the view inside
   * a group is this same view with one filter -- a second component is where
   * the last attempt at grouping went wrong.
   */
  const activeGroupId = searchParams.get('group')
  const activeGroup = groups.groups.find((g) => g.id === activeGroupId) ?? null

  // A group that no longer exists -- dissolved in another tab, or a stale link
  // -- drops you back to top level rather than showing an empty wall.
  useEffect(() => {
    if (!activeGroupId || groups.loading) return
    if (!groups.groups.some((g) => g.id === activeGroupId)) {
      router.replace('/video')
    }
  }, [activeGroupId, groups.loading, groups.groups, router])

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

  /**
   * The clips this view is showing.
   *
   * At top level a grouped clip is *absent*, not shown twice -- the group card
   * stands in for its members, which is the collapse that makes grouping worth
   * having. Inside a group it is exactly that group's clips. Filtered here
   * rather than in SQL, the way the gallery does it: the route already holds
   * every row, so a group view is one filter instead of a second query.
   */
  const shownVideos = useMemo(
    () =>
      activeGroupId
        ? videos.filter((video) => video.group_id === activeGroupId)
        : videos.filter((video) => !video.group_id),
    [videos, activeGroupId],
  )

  /**
   * The wall's cells: loose clips and group cards in one order.
   *
   * A group's key is its newest live member's time, which `readGroups` already
   * computes -- so a group sorts among the clips by the same clock they do,
   * and a group with a clip from this morning sits exactly where that clip
   * would have. Sorting groups as a block ahead of every clip would pin one
   * finished months ago above this morning's work.
   *
   * No group cards inside a group: membership is exclusive, so a group card
   * there would stand in for members already on screen.
   */
  const cells = useMemo(() => {
    const clipCells = shownVideos.map((video) => ({
      key: video.id,
      cell: { kind: 'clip' as const, video },
      sortOrder: new Date(video.created_at).getTime() / 1000,
    }))

    const groupCells = activeGroupId
      ? []
      : groups.groups.map((group) => ({
          key: group.id,
          cell: { kind: 'group' as const, group },
          sortOrder: group.sort_order,
        }))

    return [...groupCells, ...clipCells]
      .sort((a, b) => b.sortOrder - a.sortOrder)
      .map(({ key, cell }) => ({ key, ...cell }))
  }, [shownVideos, groups.groups, activeGroupId])

  /**
   * What each group has in flight, counted off rows this hook already holds.
   *
   * Arithmetic rather than a field on the summary (#350): a count that rode on
   * the group read would make every settle a reason to re-read the groups,
   * which is the churn that read is trying not to cause.
   */
  const workingByGroup = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const video of videos) {
      if (!video.group_id || video.status !== 'pending') continue
      counts[video.group_id] = (counts[video.group_id] ?? 0) + 1
    }
    return counts
  }, [videos])

  // Re-read the summaries when a group *finishes*, not when each clip lands: a
  // settled clip changes that group's cover and count, and one read at the end
  // of a batch is the cheapest moment to pick both up.
  const workingRef = useRef(workingByGroup)
  useEffect(() => {
    const before = workingRef.current
    workingRef.current = workingByGroup
    const drained = Object.keys(before).some(
      (groupId) => before[groupId] > 0 && !workingByGroup[groupId],
    )
    if (drained) void groups.refresh()
  }, [workingByGroup, groups.refresh])

  /**
   * Patch the rows a group write moved, rather than re-reading the wall.
   *
   * Membership is a column on the clip row and this hook holds every row, so
   * filing four clips is a field change here -- the group card's new cover and
   * count arrive with the write's own response a moment later.
   */
  const applyGroupWrite = useCallback(
    (write: GroupWrite | null) => {
      // A failure has already toasted and re-read the groups; the wall re-reads
      // too rather than this trying to remember what it moved.
      if (!write) {
        void refresh()
        return
      }
      if (write.moved) {
        const moved = new Set(write.moved.ids)
        const groupId = write.moved.groupId
        setVideos((current) =>
          current.map((video) =>
            moved.has(video.id) ? { ...video, group_id: groupId } : video,
          ),
        )
      }
      if (write.trashed.length > 0) {
        const gone = new Set(write.trashed)
        setVideos((current) => current.filter((video) => !gone.has(video.id)))
      }
    },
    [refresh],
  )

  /**
   * What the group dialogs are doing, and to which clips.
   *
   * One piece of state for all of them rather than a boolean and a target
   * apiece: they are steps in one flow -- pick a group, or fall through to
   * naming a new one -- and separate flags let two of them be open at once.
   */
  const [groupFlow, setGroupFlow] = useState<
    | { kind: 'pick'; targets: Array<string> }
    | { kind: 'create'; targets: Array<string> }
    | { kind: 'rename'; group: ImageGroupSummary }
    | { kind: 'confirm-dissolve'; group: ImageGroupSummary }
    | { kind: 'confirm-trash'; group: ImageGroupSummary }
    | null
  >(null)

  const closeGroupFlow = useCallback(() => setGroupFlow(null), [])

  /**
   * Picking several clips at once, to bin them in one go (#517).
   *
   * `useSelection` and `SelectionDrawer` unchanged from Images -- the whole
   * point of both is that a route supplies the verbs and nothing else. The
   * verbs here are one, deliberately: a wall of takes is a thing you prune,
   * and everything else grouping would add is a separate piece of work.
   *
   * **Select mode is a selection, not a switch** (#325, unchanged): being in
   * the mode is having something picked, so Deselect all and Escape are the
   * way out because emptying the selection is the only thing leaving could
   * mean. The tick is on every card always, which is what makes picking up
   * again after a delete one click rather than a mode to re-enter.
   *
   * The item list is the clip list in render order, so shift-click selects the
   * range you can see between two cards.
   */
  const selection = useSelection({
    items: shownVideos.map((video) => video.id),
  })
  const selectMode = selection.count > 0

  useEffect(() => {
    if (!selectMode) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') selection.clearSelection()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectMode, selection])

  const [isBatchDeleting, setIsBatchDeleting] = useState(false)

  /**
   * Bin the selection.
   *
   * `trashGalleryImages` is the gallery's own bulk trash, taken as-is: it
   * dispatches on `status`, never on `source`, so the three outcomes it already
   * decides between are the three this route wants -- a generating clip is
   * cancelled at FAL first, a generating or failed row goes outright, and a
   * finished one soft-deletes into Trash, which lists clips (#384). Same
   * reasoning `deleteVideo` gives for borrowing the single-row version.
   *
   * One call for the set (#329), not a loop: React serialises server actions,
   * so eight clips would be eight round trips with the wall frozen until the
   * last.
   *
   * The cards leave on the click and a failure re-reads, which is the trade
   * `deleteVideo` already makes.
   */
  const deleteSelected = useCallback(async () => {
    const ids = [...selection.selectedIds]
    if (ids.length === 0) return

    const picked = new Set(ids)
    setIsBatchDeleting(true)
    setVideos((current) => current.filter((video) => !picked.has(video.id)))
    // Which also leaves the mode -- the ticks are still on every card, so
    // picking up again is one click.
    selection.clearSelection()
    try {
      await trashGalleryImages(ids)
    } catch {
      toast.error('Could not delete those clips')
      await refresh()
    } finally {
      setIsBatchDeleting(false)
    }
  }, [selection, refresh])

  /**
   * "Add to group", from the selection drawer.
   *
   * With no groups yet it skips the picker and goes straight to naming one --
   * "choose from nothing, or make one" is not a choice worth rendering.
   */
  const startAddToGroup = useCallback(() => {
    const targets = [...selection.selectedIds]
    if (targets.length === 0) return
    setGroupFlow({
      kind: groups.groups.length === 0 ? 'create' : 'pick',
      targets,
    })
  }, [selection.selectedIds, groups.groups.length])

  /** File clips into an existing group. They leave the wall on the click. */
  const addToGroup = useCallback(
    async (groupId: string, ids: Array<string>) => {
      closeGroupFlow()
      selection.clearSelection()
      applyGroupWrite(await groups.addTo(groupId, ids))
    },
    [groups, selection, closeGroupFlow, applyGroupWrite],
  )

  /** Name a new group and file the clips into it in one step. */
  const createGroup = useCallback(
    async (name: string, ids: Array<string>) => {
      closeGroupFlow()
      selection.clearSelection()
      applyGroupWrite(await groups.create(name, ids))
    },
    [groups, selection, closeGroupFlow, applyGroupWrite],
  )

  /** The drawer's Remove from group -- only inside one. Deletes nothing. */
  const removeFromGroup = useCallback(async () => {
    const ids = [...selection.selectedIds]
    if (ids.length === 0) return
    selection.clearSelection()
    applyGroupWrite(await groups.removeFrom(ids))
  }, [groups, selection, applyGroupWrite])

  /**
   * Open a group -- dropping the selection on the way in.
   *
   * Picking a few clips, filing them and then clicking that group is one
   * continuous intention, and it ends with wanting to be inside the group
   * rather than still picking things.
   */
  const openGroup = useCallback(
    (group: ImageGroupSummary) => {
      selection.clearSelection()
      router.push(`/video?group=${group.id}`)
    },
    [selection, router],
  )

  const leaveGroup = useCallback(() => router.push('/video'), [router])

  const renameGroup = useCallback(
    async (name: string) => {
      if (groupFlow?.kind !== 'rename') return
      const { group } = groupFlow
      closeGroupFlow()
      applyGroupWrite(await groups.rename(group.id, name))
    },
    [groupFlow, groups, closeGroupFlow, applyGroupWrite],
  )

  /** Ungroup: the clips return to the wall, the group row goes. */
  const dissolveGroup = useCallback(async () => {
    if (groupFlow?.kind !== 'confirm-dissolve') return
    const { group } = groupFlow
    closeGroupFlow()
    if (activeGroupId === group.id) router.push('/video')
    applyGroupWrite(await groups.dissolve(group.id))
  }, [
    groupFlow,
    groups,
    closeGroupFlow,
    applyGroupWrite,
    activeGroupId,
    router,
  ])

  /** The only group action that touches clips, which is why it asks first. */
  const trashGroup = useCallback(async () => {
    if (groupFlow?.kind !== 'confirm-trash') return
    const { group } = groupFlow
    closeGroupFlow()
    if (activeGroupId === group.id) router.push('/video')
    applyGroupWrite(await groups.trash(group.id))
  }, [
    groupFlow,
    groups,
    closeGroupFlow,
    applyGroupWrite,
    activeGroupId,
    router,
  ])

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
  /**
   * The one clip the page is playing, if any.
   *
   * **Here rather than in the card**, which is the whole point: a card cannot
   * know that another one started, so six of them could be playing at once.
   * The page holds it, a card is engaged only while it holds the id, and
   * starting a clip is what takes it away from whatever had it.
   */
  const [playingId, setPlayingId] = useState<string | null>(null)

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
          // Every clip made while a group is open is filed into it. This is
          // the half that makes a group a place to work rather than a folder.
          groupId: activeGroupId,
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
    activeGroupId,
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
    videos: shownVideos,
    cells,
    groups: groups.groups,
    groupsLoading: groups.loading,
    expandedGroupIds: groups.expandedIds,
    groupMembers: groups.members,
    toggleGroupMembers: groups.toggleExpanded,
    workingByGroup,
    activeGroup,
    activeGroupId,
    groupFlow,
    setGroupFlow,
    closeGroupFlow,
    startAddToGroup,
    addToGroup,
    createGroup,
    removeFromGroup,
    openGroup,
    leaveGroup,
    renameGroup,
    dissolveGroup,
    trashGroup,
    selectedIds: selection.selectedIds,
    toggleSelected: selection.toggle,
    clearSelection: selection.clearSelection,
    selectedCount: selection.count,
    isBatchDeleting,
    deleteSelected,
    playingId,
    setPlayingId,
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
