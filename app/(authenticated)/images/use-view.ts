'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useDock } from './_hooks/use-dock'
import { useDownload } from './_hooks/use-download'
import { usePrefs } from './_hooks/use-prefs'
import { useUploads } from './_hooks/use-uploads'
import { useGallery } from './_hooks/use-gallery'
import { useLightbox } from './_hooks/use-lightbox'
import { useVariations } from './_hooks/use-variations'
import { useGroups } from './_hooks/use-groups'
import type { GroupWrite, ImageGroupSummary } from './_hooks/use-groups'
import type { GalleryCell } from './_components/image-gallery/image-gallery'
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
   * The group card as a live thing, not a snapshot (#350).
   *
   * A generation started inside a group is filed into it on submit, so
   * `onAfterSubmit` above refreshes the groups and the card's strip picks up a
   * working slot. Nothing refreshed them again when it *landed*: the poll lives
   * in `useGallery` and re-reads the gallery only, so the card kept saying
   * "1 working" until some unrelated write forced a group re-read.
   *
   * Watching the gallery's own rows rather than adding a second timer -- the
   * poll already knows when something settles, and this is what that means for
   * the other list. Optimistic cards are skipped: they have no row yet, so
   * their id changing is not a generation finishing.
   */
  const pendingInGroups = useMemo(
    () =>
      gallery.images
        .filter((img) => img.group_id && img.status === 'pending')
        .map((img) => img.id),
    [gallery.images],
  )

  const wasPendingInGroups = useRef(pendingInGroups)
  useEffect(() => {
    const before = wasPendingInGroups.current
    wasPendingInGroups.current = pendingInGroups
    const stillPending = new Set(pendingInGroups)
    // Only shrinkage. Growth is the submit's business, and it has already
    // refreshed -- reacting to it here would fire a second read per click.
    if (before.some((id) => !stillPending.has(id))) void groups.refresh()
  }, [pendingInGroups, groups.refresh])

  /**
   * Uploads ignores grouping entirely: every upload, grouped or not.
   */
  // Group, then order. There is no origin scope any more (#348): a group is a
  // scope you made on purpose, and it turned out to be the only one worth
  // having -- `use-prefs` had predicted its own deletion in a comment.
  //
  // At top level a grouped image is *absent*, not shown twice: the group card
  // stands in for its members. If members also appeared loose, the wall would
  // be exactly as tall as before.
  const scoped = useMemo(() => {
    if (activeGroupId) {
      return gallery.images.filter((img) => img.group_id === activeGroupId)
    }
    return gallery.images.filter((img) => !img.group_id)
  }, [gallery.images, activeGroupId])

  const images = prefs.sortAsc ? [...scoped].reverse() : scoped

  /**
   * The grid's cells: loose images and group cards in one order (#324).
   *
   * A group's key is its newest live member's `sort_order`, computed by
   * `listImageGroups` in the same units an image uses -- so the comparison is
   * the ordinary one and a group with a picture from this morning sits exactly
   * where that picture would. Group cards used to render as their own block
   * ahead of every image, which pinned a group finished months ago above
   * everything made since.
   *
   * Merged here rather than in the component, and before the ascending flip
   * below reaches it, so one sequence reverses rather than two lists that would
   * each need their own reversal to stay interleaved.
   */
  const cells: Array<GalleryCell> = useMemo(() => {
    const imageCells = scoped.map((image) => ({
      cell: { kind: 'image' as const, image },
      sortOrder:
        image.sort_order ?? new Date(image.created_at).getTime() / 1000,
    }))
    // Groups appear at top level only: inside one there is nothing to nest.
    const groupCells = activeGroupId
      ? []
      : groups.groups.map((group) => ({
          cell: { kind: 'group' as const, group },
          sortOrder: group.sort_order,
        }))

    const ordered = [...groupCells, ...imageCells].sort(
      (a, b) => b.sortOrder - a.sortOrder,
    )
    const cellsDesc = ordered.map((o) => o.cell)
    return prefs.sortAsc ? cellsDesc.reverse() : cellsDesc
  }, [scoped, groups.groups, activeGroupId, prefs.sortAsc])

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

  /**
   * Select mode is a selection, not a switch (#325).
   *
   * A mode rather than a circle per card is still right -- the use that
   * justifies selection is bulk, and per-card circles make clearing twelve of
   * sixteen twelve precise clicks on a small corner. What changed is the way
   * in: the tick on each card, which is on every card always. Turning a mode on
   * from the toolbar asked you to declare an intention before you could touch
   * the picture you were already looking at, and the toggle was also the only
   * thing saying selection existed.
   *
   * So there is no mode state. Being in the mode *is* having something picked;
   * Deselect all and Escape are the way out because emptying the selection is
   * the only thing leaving could mean.
   *
   * This retires the rule that the mode must survive a batch action ("delete
   * three, then select four more"). That rule protected a modal entry point:
   * after an auto-exit the affordance was gone and a click on a card meant
   * something different with nothing on screen saying so. The tick never goes
   * away now -- select is the corner, open is the image -- so picking up again
   * after a delete is the one click it was before.
   *
   * Selecting attaches nothing to the next generation. It used to feed
   * `setAutoRefImageIds`, so looking through images silently changed what the
   * next prompt was built from; references have their own surface, which says
   * what it has collected.
   */
  const selectMode = selection.count > 0

  /**
   * Open a group -- dropping the selection on the way in.
   *
   * Selecting a few images, filing them into a group and then clicking that
   * group is one continuous intention, and it ends with wanting to be inside
   * the group rather than still picking things. Carrying it across would also
   * carry a selection of images the new view does not show.
   *
   * Defined here rather than beside `leaveGroup` because it is the piece that
   * needs the selection; leaving a group has nothing to undo.
   */
  const openGroup = useCallback(
    (group: ImageGroupSummary) => {
      selection.clearSelection()
      router.push(`/images?group=${group.id}`)
    },
    [selection, router],
  )

  useEffect(() => {
    if (!selectMode) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') selection.clearSelection()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectMode, selection])

  const [isBatchDeleting, setIsBatchDeleting] = useState(false)

  const deleteSelected = useCallback(async () => {
    const targets = images.filter((img) => selection.selectedIds.has(img.id))
    setIsBatchDeleting(true)
    try {
      // One call for the set (#329). This was a loop of one action per image,
      // awaited -- and React serialises server actions anyway, so twelve
      // pictures was twelve round trips with the grid frozen until the last.
      await gallery.deleteImages(targets)
      // Which also leaves the mode. The ticks are still on every card, so
      // picking up again is one click -- see the note on `selectMode`.
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
    // Picking where an upload is about to go, before any file has been chosen
    // (#348). No `targets`: the images do not exist yet, which is what makes it
    // its own kind rather than a 'pick' with an empty list.
    | { kind: 'upload-target' }
    | { kind: 'create'; targets: Array<string> }
    | { kind: 'rename'; group: ImageGroupSummary }
    // Picking where a whole group's contents are headed (#350). Carries the
    // source group rather than image ids: the images are not enumerated
    // client-side at all -- at top level the grid does not even hold them.
    | { kind: 'move'; group: ImageGroupSummary }
    | { kind: 'confirm-dissolve'; group: ImageGroupSummary }
    | { kind: 'confirm-trash'; group: ImageGroupSummary }
    | null
  >(null)

  const closeGroupFlow = useCallback(() => setGroupFlow(null), [])

  /**
   * "Upload to group" from the toolbar: choose the destination, then the files.
   *
   * Never offered with no groups to choose from -- the toolbar renders a plain
   * Upload button in that case, since "file these into nothing, or go make a
   * group first" is the same non-choice `GroupPickerDialog` already refuses.
   */
  const startUploadToGroup = useCallback(
    () => setGroupFlow({ kind: 'upload-target' }),
    [],
  )

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

  /**
   * The gallery's half of a group write (#331).
   *
   * Membership is a column on the image row and the gallery already holds
   * every row, so a write that moved pictures is a field patch here, not a
   * re-read. The group half is `useGroups`' own; both land in the same tick,
   * which is what makes filing four images look instant instead of pausing
   * for three serialised round trips.
   */
  const applyGroupWrite = useCallback(
    (write: GroupWrite | null) => {
      // A failure has already toasted and re-read the groups. The gallery
      // re-reads too rather than this trying to remember what it moved.
      if (!write) {
        void gallery.refresh({ silent: true })
        return
      }
      if (write.moved) {
        gallery.patchImages(write.moved.ids, { group_id: write.moved.groupId })
      }
      if (write.trashed.length > 0) gallery.forgetImages(write.trashed)
    },
    [gallery],
  )

  /**
   * Filing images into a group: the pictures leave top level on the click.
   *
   * The optimistic half is the cheap one -- membership is a field, and the
   * grid can act on it before the server answers. The group card's new cover
   * and count arrive with the response a moment later, because that is the
   * arithmetic worth taking from the database rather than reproducing here.
   */
  const addToGroup = useCallback(
    async (groupId: string, imageIds: Array<string>) => {
      closeGroupFlow()
      gallery.patchImages(imageIds, { group_id: groupId })
      selection.clearSelection()
      applyGroupWrite(await groups.addTo(groupId, imageIds))
    },
    [groups, gallery, selection, closeGroupFlow, applyGroupWrite],
  )

  /**
   * Uploading, with the open group as the default destination (#348).
   *
   * At top level `activeGroupId` is null and files land loose. Inside a group
   * they land in it, with no dialog: a group is a focus session, and asking
   * which group you meant while you are standing in one is ceremony. That is
   * a deliberate exception to "one way to do things" -- the toolbar's menu is
   * top-level only, and the reasoning is on the toolbar.
   */
  const { uploadFiles: uploadFilesRaw } = useUploads(
    user.id,
    gallery,
    addToGroup,
  )

  const uploadFiles = useCallback(
    (files: Array<File>, groupId: string | null = activeGroupId) => {
      void uploadFilesRaw(files, groupId).then(() => {
        // Only the explicit to-a-group upload speaks. Uploading into the group
        // you are looking at needs no announcement -- the cards are right
        // there. Filing from top level moves them somewhere you are not, so
        // without this the only visible effect is a card gaining a new cover.
        if (!groupId || groupId === activeGroupId) return
        const name = groups.groups.find((g) => g.id === groupId)?.name
        if (name) toast(`Uploaded to ${name}`)
      })
    },
    [uploadFilesRaw, activeGroupId, groups.groups],
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
      // Not optimistic, unlike `addToGroup`: there is no group id to move the
      // images into until the insert answers, and hiding them under a
      // placeholder id would empty their space with no card standing in it.
      // One round trip is the whole win here.
      applyGroupWrite(await groups.create(name, imageIds))
      // Clearing is leaving now -- the images are filed, the picking is over.
      selection.clearSelection()
    },
    [groups, selection, closeGroupFlow, applyGroupWrite],
  )

  const removeFromGroup = useCallback(
    async (imageIds: Array<string>) => {
      gallery.patchImages(imageIds, { group_id: null })
      selection.clearSelection()
      applyGroupWrite(await groups.removeFrom(imageIds))
    },
    [groups, gallery, selection, applyGroupWrite],
  )

  const renameGroup = useCallback(
    async (groupId: string, name: string) => {
      closeGroupFlow()
      await groups.rename(groupId, name)
    },
    [groups, closeGroupFlow],
  )

  /**
   * Move a group's contents into another and drop the emptied one (#350).
   *
   * Not optimistic: at top level the members are exactly the rows the grid
   * filters out, so there is nothing on screen to move ahead of the answer.
   * The write returns the moved ids anyway, which is what keeps a gallery that
   * *is* holding them (someone standing in the source group) correct.
   */
  const moveGroup = useCallback(
    async (sourceGroupId: string, targetGroupId: string) => {
      closeGroupFlow()
      applyGroupWrite(await groups.moveContents(sourceGroupId, targetGroupId))
      // Standing in a group that just ceased to exist: follow the pictures.
      if (activeGroupId === sourceGroupId) {
        router.push(`/images?group=${targetGroupId}`)
      }
    },
    [groups, activeGroupId, router, closeGroupFlow, applyGroupWrite],
  )

  /** Keeps every picture, returns them to top level, drops the group row. */
  const dissolveGroup = useCallback(
    async (groupId: string) => {
      closeGroupFlow()
      applyGroupWrite(await groups.dissolve(groupId))
      if (activeGroupId === groupId) router.push('/images')
    },
    [groups, activeGroupId, router, closeGroupFlow, applyGroupWrite],
  )

  /** The card's delete icon: the members go to Trash, the group goes. Asks
   *  first, being the one group action that touches pictures -- and safe to
   *  offer at all because Trash is the way back. */
  const trashGroup = useCallback(
    async (groupId: string) => {
      closeGroupFlow()
      // The write returns the ids it soft-deleted, so the cards leave without
      // a re-read -- the same shape as the selection drawer's Trash (#329).
      applyGroupWrite(await groups.trash(groupId))
      if (activeGroupId === groupId) router.push('/images')
    },
    [groups, activeGroupId, router, closeGroupFlow, applyGroupWrite],
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
    cells,
    gallery,
    groups,
    activeGroup,
    activeGroupId,
    openGroup,
    leaveGroup,
    groupFlow,
    setGroupFlow,
    closeGroupFlow,
    startAddToGroup,
    startUploadToGroup,
    addToGroup,
    createGroup,
    removeFromGroup,
    renameGroup,
    moveGroup,
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
