'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useDock } from './_hooks/use-dock'
import { useDownload } from './_hooks/use-download'
import { usePrefs } from './_hooks/use-prefs'
import { useUploads } from './_hooks/use-uploads'
import { useGallery } from './_hooks/use-gallery'
import { useLightbox } from './_hooks/use-lightbox'
import { useVariations } from './_hooks/use-variations'
import { usePasteReference } from './_hooks/use-paste-reference'
import { useGroups } from './_hooks/use-groups'
import type { ImageGroupSummary } from './_hooks/use-groups'
import type { SavedAiImage } from '#/features/ai-images/types'
import { useAuth } from '#/lib/auth'
import { imageUrl } from '#/lib/image-url'
import { useModelSelector } from '#/features/ai-images/model-selector/use-model-selector'
import { useGenerator } from '#/features/ai-images/hooks/use-generator'
import { useUserImages } from '#/features/user-images/hooks/use-user-images'
import { useSelection } from '#/lib/use-selection'
import { toast } from '#/components'

/**
 * The card a generation shows between the click and its row (#313).
 *
 * Shaped as a real pending row rather than as a third card state, so
 * `image-gallery` needs no branch for it: the same `PendingImageCard` renders
 * this and the row that replaces it, and the swap is invisible.
 *
 * `group_id` is carried because a generation made inside a group is filed into
 * it -- without it the card would be filtered out of the view that created it.
 */
function pendingCard(
  placeholder: {
    placeholderId: string
    model: string
    prompt: string
    sourceImageId?: string
  },
  groupId: string | null,
): SavedAiImage {
  return {
    id: placeholder.placeholderId,
    origin: 'images',
    title: 'Generating...',
    storage_path: null,
    created_at: new Date().toISOString(),
    status: 'pending',
    group_id: groupId,
    generation_error: null,
    generation_metadata: {
      prompt: placeholder.prompt,
      model: placeholder.model,
      ...(placeholder.sourceImageId
        ? { source_image_id: placeholder.sourceImageId }
        : {}),
    },
  }
}

/**
 * The state `view.tsx` renders.
 *
 * The first read is the server component's -- `page.tsx` runs
 * `listGalleryImages()` and hands the rows in as `initial`, so there is no
 * loading state and no empty first paint. `useGallery` owns every read after
 * that, and its 5s poll is the only signal that anything changed.
 */
export function useView(initial: Array<SavedAiImage>) {
  const { user } = useAuth()
  const router = useRouter()

  // The group being worked in lives in the URL (#319), not in local state like
  // the origin pills. A group is a place: it survives a reload, it can be
  // linked, and the browser's Back button is the same gesture as the chevron in
  // the toolbar. `?group=` rather than a route segment, because the view is
  // literally `/images` with a filter -- a second route would be a second
  // component, and a second component is where the last attempt at grouping
  // grew its own UI (#204).
  const searchParams = useSearchParams()
  const activeGroupId = searchParams.get('group')

  const groups = useGroups()
  const activeGroup = groups.groups.find((g) => g.id === activeGroupId) ?? null

  // A group that no longer exists -- dissolved on another tab, or a stale link
  // -- must not leave the grid showing nothing with a name in the toolbar.
  useEffect(() => {
    if (!activeGroupId || groups.loading) return
    if (!groups.groups.some((g) => g.id === activeGroupId)) {
      router.replace('/images')
    }
  }, [activeGroupId, groups.loading, groups.groups, router])

  const leaveGroup = useCallback(() => router.push('/images'), [router])

  const gallery = useGallery({ userId: user.id, initial })
  const userImages = useUserImages(user.id)
  const prefs = usePrefs()
  const dock = useDock()
  const download = useDownload()
  // Making something is an implicit request to see it. The scope defaults to
  // generations (#207), so without these a card the user just created lands in
  // a bucket the current pill hides -- an upload while scoped to generations, a
  // generation while scoped to uploads. Only widens; never narrows.
  const reveal = useCallback(
    (filter: 'uploads' | 'images') => {
      if (prefs.originFilter !== filter && prefs.originFilter !== 'all') {
        prefs.setOriginFilter(filter)
      }
    },
    [prefs],
  )

  const revealUploads = useCallback(() => reveal('uploads'), [reveal])

  const { uploadFiles } = useUploads(user.id, gallery, revealUploads)

  const modelSelector = useModelSelector({
    capability: 'sidebar',
    mode: 'multi',
  })

  const [error, setError] = useState<string | null>(null)

  const generator = useGenerator({
    origin: 'images',
    selectedModels: modelSelector.selectedIds,
    gensPerModel: modelSelector.gensPerModel,
    setError,
    // A submit inserts pending rows server-side. The gallery used to hear about
    // them on the realtime INSERT (#174); it now asks once the submits land,
    // and the 5s poll takes over from there until they settle.
    // Every generation made while a group is open is filed into it. This is
    // the half that makes a group a place to work rather than a folder: the
    // filing is a byproduct of generating, not a chore afterwards.
    groupId: activeGroupId,
    // Cards on click, from local state, before anything has been asked of the
    // server (#313). The upload path has always done this; generation never
    // adopted it, which is why pasting felt instant and generating did not.
    onSubmitStart: (placeholders) => {
      reveal('images')
      for (const p of placeholders) {
        gallery.addOptimisticCard(pendingCard(p, activeGroupId))
      }
    },
    // Each card resolves on its own submit rather than on the slowest one's.
    // A success swaps in the real row id so the refresh below recognises the
    // card it already drew; a failure that never reached the database takes
    // the card with it.
    onSubmitOutcome: ({ placeholderId, recordId }) => {
      if (recordId) {
        gallery.replaceOptimisticCard(placeholderId, (card) => ({
          ...card,
          id: recordId,
        }))
      } else {
        gallery.removeOptimisticCard(placeholderId)
      }
    },
    onAfterSubmit: () => {
      void gallery.refresh({ silent: true })
      void groups.refresh()
    },
  })

  /**
   * Uploads ignores grouping entirely: every upload, grouped or not.
   *
   * The other scopes hide a grouped image behind its group card, which is the
   * whole payoff -- a wall of thirty becomes three cards and eight loose
   * pictures. Uploads is not that kind of question. An upload is something you
   * put there deliberately, and "show me my uploads" means all of them; where
   * each one happens to sit is somebody else's concern. So this scope shows no
   * group cards either -- there is nothing left for them to stand in for.
   */
  const uploadsIgnoreGroups = !activeGroupId && prefs.originFilter === 'uploads'

  // Group first, then scope, then order. The filter is client-side on purpose:
  // the gallery already holds every row, so switching pills is instant and
  // costs no round trip -- and `origin` is immutable, so a filtered-out row
  // cannot become stale.
  //
  // At top level a grouped image is *absent*, not shown twice: the group card
  // stands in for its members. If members also appeared loose, the wall would
  // be exactly as tall as before.
  //
  // Inside a group there is no origin filtering at all -- the group is already
  // the scope, and two scoping controls stacked on each other only raise the
  // question of which one wins.
  const scoped = useMemo(() => {
    if (activeGroupId) {
      return gallery.images.filter((img) => img.group_id === activeGroupId)
    }
    if (uploadsIgnoreGroups) {
      return gallery.images.filter((img) => img.origin === 'upload')
    }
    const loose = gallery.images.filter((img) => !img.group_id)
    if (prefs.originFilter === 'all') return loose
    return loose.filter((img) => img.origin === prefs.originFilter)
  }, [gallery.images, prefs.originFilter, activeGroupId, uploadsIgnoreGroups])

  const images = prefs.sortAsc ? [...scoped].reverse() : scoped

  // An image copied from the search overlay pastes in as a reference (#213).
  usePasteReference({
    addRefImages: generator.addRefImages,
    maxRefImages: generator.maxRefImages,
    refCount: generator.refImages.length,
  })

  // The list the grid renders, minus the cards with nothing to look at (#270).
  // Scoped and sorted like the grid, because the filmstrip shows this list and
  // a lightbox cycling something else is visibly wrong, not subtly wrong.
  const lightboxImages = useMemo(
    () => images.filter((img) => img.status === 'completed'),
    [images],
  )

  const lightbox = useLightbox(lightboxImages, gallery.deleteImage)
  // The same cursor over the same list, driving the in-place preview instead of
  // the overlay. Its own instance so the two do not share a position: stepping
  // through one is not meant to move the other.
  const experiment = useLightbox(lightboxImages)
  const variations = useVariations({ setError })

  const selection = useSelection({ items: images.map((img) => img.id) })

  // Select mode (#284). A mode rather than a circle per card: the use that
  // justifies selection is bulk, and per-card circles make clearing twelve of
  // sixteen twelve precise clicks on a small corner. The cost is modality, paid
  // for by a toolbar toggle that reads as on and by Escape always leaving.
  //
  // Selecting attaches nothing to the next generation. It used to feed
  // `setAutoRefImageIds`, so looking through images silently changed what the
  // next prompt was built from; references have their own surface, which says
  // what it has collected.
  const [selectMode, setSelectMode] = useState(false)

  const exitSelectMode = useCallback(() => {
    setSelectMode(false)
    selection.clearSelection()
  }, [selection])

  const toggleSelectMode = useCallback(() => {
    if (selectMode) {
      exitSelectMode()
      return
    }
    setSelectMode(true)
  }, [selectMode, exitSelectMode])

  /**
   * Open a group -- and leave select mode on the way in.
   *
   * The one automatic exit, and it does not contradict the rule below it. That
   * rule is about *batch actions*: "delete three, then select four more" is a
   * real pattern, so finishing a batch must not silently change what the next
   * click does. This is navigation. Selecting a few images, filing them into a
   * group and then clicking that group is one continuous intention, and it ends
   * with wanting to be inside the group rather than still picking things.
   * Carrying the mode across would also carry a selection of images the new
   * view does not show.
   *
   * Defined here rather than beside `leaveGroup` because it is the piece that
   * needs select mode; leaving a group has nothing to undo.
   */
  const openGroup = useCallback(
    (group: ImageGroupSummary) => {
      exitSelectMode()
      router.push(`/images?group=${group.id}`)
    },
    [exitSelectMode, router],
  )

  // Always, and never automatically after a batch action: "delete three, then
  // select four more" is a real pattern, and auto-exit punishes it by silently
  // changing what the next click does.
  useEffect(() => {
    if (!selectMode) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') exitSelectMode()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectMode, exitSelectMode])

  const [isBatchDeleting, setIsBatchDeleting] = useState(false)

  const deleteSelected = useCallback(async () => {
    const targets = images.filter((img) => selection.selectedIds.has(img.id))
    setIsBatchDeleting(true)
    try {
      for (const img of targets) await gallery.deleteImage(img)
      // The mode stays on -- see exitSelectMode.
      selection.clearSelection()
    } finally {
      setIsBatchDeleting(false)
    }
  }, [images, selection, gallery])

  const [describeTarget, setDescribeTarget] = useState<SavedAiImage | null>(
    null,
  )

  // ---------------------------------------------------------------------
  // Groups (#319)
  // ---------------------------------------------------------------------

  /**
   * What the group dialogs are doing, and to which images.
   *
   * One piece of state for all three dialogs rather than three booleans and a
   * target apiece: they are steps in one flow -- pick a group, or fall through
   * to naming a new one -- and separate flags let two of them be open at once.
   *
   * `targets` is empty for the toolbar's New group, which creates an empty one.
   * That is a legitimate way to start: name the thing you are about to work on,
   * then generate into it.
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
   * "Add to group", from the card menu or the selection drawer.
   *
   * With no groups yet it skips the picker and goes straight to naming one --
   * "choose from nothing, or make one" is not a choice worth rendering.
   */
  const startAddToGroup = useCallback(
    (targets: Array<string>) => {
      if (targets.length === 0) return
      setGroupFlow({
        kind: groups.groups.length === 0 ? 'create' : 'pick',
        targets,
      })
    },
    [groups.groups.length],
  )

  const addToGroup = useCallback(
    async (groupId: string, imageIds: Array<string>) => {
      closeGroupFlow()
      await groups.addTo(groupId, imageIds)
      await gallery.refresh({ silent: true })
      selection.clearSelection()
    },
    [groups, gallery, selection, closeGroupFlow],
  )

  /**
   * Create, and stay where you are. Always -- empty group or not.
   *
   * Creating used to navigate into the group, on the theory that making one is
   * a statement about what you are working on next. Using it said otherwise:
   * you select a few similar images from top level, hit Create group, and being
   * thrown somewhere else is disorienting even though the intent was clear.
   *
   * The empty case briefly kept the old behaviour, since there is nothing to
   * stay and look at. That is a defensible exception and still the wrong call:
   * creating a group means one thing wherever it is done, and clicking the card
   * is the way in. One rule beats a better rule you have to remember.
   */
  const createGroup = useCallback(
    async (name: string, imageIds: Array<string>) => {
      closeGroupFlow()
      const id = await groups.create(name, imageIds)
      if (!id) return
      await gallery.refresh({ silent: true })
      selection.clearSelection()
      setSelectMode(false)
    },
    [groups, gallery, selection, closeGroupFlow],
  )

  const removeFromGroup = useCallback(
    async (imageIds: Array<string>) => {
      await groups.removeFrom(imageIds)
      await gallery.refresh({ silent: true })
      selection.clearSelection()
    },
    [groups, gallery, selection],
  )

  const renameGroup = useCallback(
    async (groupId: string, name: string) => {
      closeGroupFlow()
      await groups.rename(groupId, name)
    },
    [groups, closeGroupFlow],
  )

  /** Keeps every picture, returns them to top level, drops the group row. */
  const dissolveGroup = useCallback(
    async (groupId: string) => {
      closeGroupFlow()
      await groups.dissolve(groupId)
      await gallery.refresh({ silent: true })
      if (activeGroupId === groupId) router.push('/images')
    },
    [groups, gallery, activeGroupId, router, closeGroupFlow],
  )

  /** The card's delete icon: the members go to Trash, the group goes. Asks
   *  first, being the one group action that touches pictures -- and safe to
   *  offer at all because Trash is the way back. */
  const trashGroup = useCallback(
    async (groupId: string) => {
      closeGroupFlow()
      await groups.trash(groupId)
      await gallery.refresh({ silent: true })
      if (activeGroupId === groupId) router.push('/images')
    },
    [groups, gallery, activeGroupId, router, closeGroupFlow],
  )

  const setGroupCoverImage = useCallback(
    async (img: SavedAiImage) => {
      if (!img.group_id) return
      await groups.setCover(img.group_id, img.id)
    },
    [groups],
  )

  // The two power moves: Cmd-click a card to add its image, Cmd-click its prompt
  // for its text -- so "these images, my words" is a handful of clicks from
  // anywhere in the grid. Neither touches anything else: not the count, not the
  // additional prompts, not the model selection.
  //
  // Both open the panel. A power move whose entire effect is inside a closed
  // panel has no feedback at all, which is the reason #284 refused to put a
  // "use as source" button on the card.
  //
  // **One modifier, not two.** Cmd-click used to replace the first image and
  // Cmd-Shift-click push onto the rest -- a real distinction only while a source
  // slot existed to be replaced. Over one set (#297) they were the same gesture
  // with a rule to remember, and the replacing one was the wrong default:
  // clicking three cards left one image, not three.
  const addReference = useCallback(
    (img: SavedAiImage) => {
      if (!img.storage_path) return
      // Refusing out loud, the same way the paste path does (#213): the set
      // caps at the selected model's `maxRefImages`, and a gesture that reports
      // nothing and adds nothing is worse than one that says no.
      if (generator.maxRefImages === 0) {
        toast('The selected model does not take images')
        return
      }
      dock.setOpen(true)
      // Onto the front, evicting the last. A full set is the normal case for
      // this gesture, not the exception -- see `pushRef`.
      //
      // Adding is its own feedback: the set visibly gains an image. Dropping
      // one is not, and it is the half you would want to know about, so it is
      // the only outcome that says anything. At capacity 1 every click evicts,
      // which is correct and also why a single-image model made the old
      // replace-slot-0 binding impossible to tell apart from this one.
      const evicts =
        generator.refImages.length >= generator.maxRefImages &&
        !generator.refImages.some((r) => r.id === img.id)
      generator.pushRefImage({
        id: img.id,
        url: imageUrl(img.id),
        title: img.title,
      })
      if (evicts) {
        toast(
          `Image added; the last one dropped (max ${generator.maxRefImages})`,
        )
      }
    },
    [generator, dock],
  )

  const usePromptText = useCallback(
    (text: string) => {
      dock.setOpen(true)
      // `setPrompt` is prompts[0] only, so a second prompt row someone is
      // holding on to survives this.
      generator.setPrompt(text)
    },
    [generator, dock],
  )

  /** Take a still to /video as its first frame (#305). A navigation rather
   *  than a panel: video is its own route, and the image travels as an id in
   *  the URL so the target needs no shared state. */
  const animate = useCallback(
    (img: SavedAiImage) => {
      router.push(`/video?image=${img.id}`)
    },
    [router],
  )

  /** The source image's URL, for the variation dialog's preview. */
  const variationSourceUrl = variations.pendingSourceImage
    ? gallery.imageUrls[variations.pendingSourceImage.id]
    : undefined

  return {
    images,
    gallery,
    groups,
    activeGroup,
    activeGroupId,
    uploadsIgnoreGroups,
    openGroup,
    leaveGroup,
    groupFlow,
    setGroupFlow,
    closeGroupFlow,
    startAddToGroup,
    addToGroup,
    createGroup,
    removeFromGroup,
    renameGroup,
    dissolveGroup,
    trashGroup,
    setGroupCoverImage,
    userImages,
    modelSelector,
    generator,
    prefs,
    dock,
    download,
    uploadFiles,
    selection,
    selectMode,
    toggleSelectMode,
    isBatchDeleting,
    deleteSelected,
    lightbox,
    experiment,
    variations,
    variationSourceUrl,
    describeTarget,
    setDescribeTarget,
    addReference,
    usePromptText,
    animate,
    error,
    setError,
  }
}
