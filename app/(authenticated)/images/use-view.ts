'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useHotkey } from '@tanstack/react-hotkeys'
import { useDock } from './_hooks/use-dock'
import { useDownload } from './_hooks/use-download'
import { usePrefs } from './_hooks/use-prefs'
import { useUploads } from './_hooks/use-uploads'
import { useGallery } from './_hooks/use-gallery'
import { useImageViewer } from './_hooks/use-image-viewer'
import { useGroups } from './_hooks/use-groups'
import type { GroupWrite, ImageGroupSummary } from './_hooks/use-groups'
import type { GalleryCell } from './_components/image-gallery/image-gallery'
import type { SavedAiImage } from '#/features/ai-images/types'
import { loadGeneration } from '#/features/ai-images/server/load-generation.action'
import { useAuth } from '#/lib/auth'
import { imageUrl } from '#/lib/image-url'
import { useModelSelector } from '#/features/ai-images/model-selector/use-model-selector'
import { takePanelHandoff } from '#/lib/panel-handoff'
import { useGenerator } from '#/features/ai-images/hooks/use-generator'
import { useUserImages } from '#/features/user-images/hooks/use-user-images'
import { useSelection } from '#/lib/use-selection'
import { getRatioOptions, toast } from '#/components'

/**
 * The card a generation shows between the click and its row (#313).
 *
 * Shaped as a real pending row rather than as a third card state, so
 * `image-gallery` needs no branch for it: the same `PendingImageCard` renders
 * this and the row that replaces it.
 *
 * The swap is invisible because the card's React key is not its id (#353) --
 * `keyFor` in `use-gallery`. It was not, for a while: the id was the key, so
 * swapping it destroyed a mounted tile and built an identical one.
 *
 * `group_id` is carried because a generation made inside a group is filed into
 * it -- without it the card would be filtered out of the view that created it.
 */
function pendingCard(
  placeholder: {
    placeholderId: string
    model: string
    title: string
    prompt: string
    sourceImageId?: string
  },
  groupId: string | null,
): SavedAiImage {
  return {
    id: placeholder.placeholderId,
    origin: 'images',
    // The model, not 'Generating...' (#367). The card knew which model it was
    // at click time and displayed a placeholder anyway, so the badge renamed
    // itself ~10s later for no reason a viewer could act on. Pending-ness is
    // `status` below, which is what the tile already styles from.
    title: placeholder.title,
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
      // Making something is an implicit request to see it (#444). Generating
      // while scoped to Uploads would otherwise draw a card into a list that
      // hides it, so the scope widens to `all` -- it never narrows, so nothing
      // you were looking at leaves the screen.
      prefs.revealAll()
      for (const p of placeholders) {
        gallery.addOptimisticCard(pendingCard(p, activeGroupId))
      }
    },
    // Each card resolves on its own submit rather than on the slowest one's.
    // A success swaps in the real row id so the refresh below recognises the
    // card it already drew; a failure that never reached the database takes
    // the card with it. The tile survives the swap -- `keyFor` (#353).
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
   * A handoff waiting from another page, applied once (#433).
   *
   * The lab's Variations page composes a set of prompts about one image and
   * has nowhere to run them; this is where they land. Read and cleared in the
   * same call, so a reload of Images does not refill a panel that has since
   * been edited, and the sender is told nothing -- its "Loaded" is a local
   * flag, not a fact anyone reconciles.
   *
   * The model selection is deliberately untouched, matching how loading a past
   * generation already behaves: the selection is the working context you are
   * already in, not part of the thing being loaded.
   */
  const handoffTaken = useRef(false)
  useEffect(() => {
    // After the dock's stored open/closed state has landed, never before: this
    // opens the panel, and `open` starts at its fallback and is corrected a
    // tick later, so an earlier call is undone rather than obeyed.
    if (!dock.hydrated || handoffTaken.current) return
    handoffTaken.current = true

    const handoff = takePanelHandoff()
    if (!handoff) return
    generator.replacePrompts(handoff.prompts)
    // The whole set, in the order it was written against (#436) -- the prompts
    // may name the images by number, so replacing is the only correct move:
    // merging into whatever the panel already held would renumber them.
    if (handoff.images) generator.replaceRefImages(handoff.images)
    // Open it, the way every other load does. A handoff fills a form, and a
    // form you cannot see has not been filled as far as anyone watching is
    // concerned -- with the dock collapsed, arriving here from Activity's Load
    // (#458) looked like a click that did nothing.
    dock.setOpen(true)
    // The ref, not an empty dep list: this has to wait for hydration, so it
    // cannot be a mount-only effect, and a delivery must still be collected
    // exactly once.
  }, [dock, generator])

  /**
   * What each group has in play right now, and the one moment worth re-reading.
   *
   * **Derived here, never read from the server** (#350). The gallery already
   * holds every row, so counting the pending ones per group is arithmetic on
   * state that is in hand -- no action, no route re-render, no list
   * replacement. A `pending_count` on the summary looked cheaper and was not:
   * it made every settle a reason to re-read the groups, and each of those is
   * a server action landing in the middle of a grid that is already swapping
   * optimistic cards for real ones.
   *
   * Uploads are counted from their destination rather than from the rows,
   * because a file on its way up has no `group_id` yet -- it gets one when the
   * batch is filed, after the last byte. Without this, uploading into a group
   * from top level is the one kind of work the card cannot see.
   */
  const [uploadingInto, setUploadingInto] = useState<Record<string, number>>({})

  const workingByGroup = useMemo(() => {
    const counts: Record<string, number> = { ...uploadingInto }
    for (const img of gallery.images) {
      if (!img.group_id || img.status !== 'pending') continue
      counts[img.group_id] = (counts[img.group_id] ?? 0) + 1
    }
    return counts
  }, [gallery.images, uploadingInto])

  /**
   * Refresh the summaries when a group *finishes*, not when each image lands.
   *
   * One read per burst rather than one per settle. That is the moment the
   * strip has something new to show, and doing it any earlier only re-composes
   * a row that is about to change again.
   */
  const wasWorking = useRef(workingByGroup)
  useEffect(() => {
    const before = wasWorking.current
    wasWorking.current = workingByGroup
    const drained = Object.keys(before).some(
      (groupId) => before[groupId] > 0 && !workingByGroup[groupId],
    )
    if (drained) void groups.refresh()
  }, [workingByGroup, groups.refresh])

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
  /**
   * **Uploads ignores grouping entirely: every upload, grouped or not** (#444).
   *
   * The other scopes are a filter over what is loose, because at top level a
   * group card stands in for its members and that collapse is the whole payoff
   * -- a wall of thirty becomes three cards and eight loose pictures. Uploads
   * is not that kind of question. An upload is something you put there
   * deliberately, and "show me my uploads" means all of them; where each one
   * happens to sit is somebody else's concern. So this scope shows no group
   * cards either -- there is nothing left for them to stand in for.
   *
   * This is the rule that replaces keeping a group called Uploads by hand,
   * which decayed every time you uploaded again.
   */
  const uploadsIgnoreGroups = !activeGroupId && prefs.originFilter === 'uploads'

  // Group first, then scope, then order. The filter is client-side on purpose:
  // the gallery already holds every row, so switching scopes is instant and
  // costs no round trip -- and `origin` is immutable, so a filtered-out row
  // cannot become stale.
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
  }, [gallery.images, activeGroupId, uploadsIgnoreGroups, prefs.originFilter])

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
    // And not under Uploads, which shows every upload wherever it sits -- a
    // group card there would stand in for members already on screen.
    const groupCells =
      activeGroupId || uploadsIgnoreGroups
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
  }, [scoped, groups.groups, activeGroupId, uploadsIgnoreGroups, prefs.sortAsc])

  // The list the grid renders, minus the cards with nothing to look at (#270).
  // Scoped and sorted exactly like the grid -- inside a group that is the
  // group's images -- because "next" has to mean the next picture on screen.
  // A viewer cycling a different list sends you somewhere you were not looking.
  const viewerImages = useMemo(
    () => images.filter((img) => img.status === 'completed'),
    [images],
  )

  const viewer = useImageViewer(viewerImages, gallery.deleteImage)

  // Cmd-Ctrl-+/- zooms the grid, the way Cmd-+/- zooms the page (#403). The
  // extra Control is what keeps the browser's own zoom reachable -- this
  // replaces the habit of using it, it does not take the key away.
  //
  // Off while the viewer is up: it covers the grid, so the gesture would resize
  // something nobody can see, and its own arrow keys are the ones in play.
  const zoomEnabled = !viewer.isOpen
  useHotkey('Control+Meta+=', () => prefs.zoomThumbs(1), {
    enabled: zoomEnabled,
    preventDefault: true,
  })
  useHotkey('Control+Meta+-', () => prefs.zoomThumbs(-1), {
    enabled: zoomEnabled,
    preventDefault: true,
  })
  useHotkey('Control+Meta+0', () => prefs.resetThumbZoom(), {
    enabled: zoomEnabled,
    preventDefault: true,
  })

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
    // Naming and downloading the open group as a zip (#477). Carries the
    // group for its name; the images come from the grid, which inside a group
    // is exactly the group's contents.
    | { kind: 'download'; group: ImageGroupSummary }
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
    activeGroupId,
  )

  const uploadFiles = useCallback(
    (files: Array<File>, groupId: string | null = activeGroupId) => {
      // Same rule as a generation: an upload while scoped to Generations would
      // land somewhere the grid is not showing.
      prefs.revealAll()
      // The destination is held for the length of the batch, so the group card
      // can say it is busy while the bytes are still going up (#350). The rows
      // themselves cannot carry this: they get their `group_id` when the batch
      // is filed, which is the moment the work is over.
      if (groupId) {
        setUploadingInto((prev) => ({
          ...prev,
          [groupId]: (prev[groupId] ?? 0) + files.length,
        }))
      }
      void uploadFilesRaw(files, groupId).then(() => {
        if (groupId) {
          setUploadingInto((prev) => {
            const left = (prev[groupId] ?? 0) - files.length
            const next = { ...prev }
            if (left > 0) next[groupId] = left
            else delete next[groupId]
            return next
          })
        }
        // Only the explicit to-a-group upload speaks. Uploading into the group
        // you are looking at needs no announcement -- the cards are right
        // there. Filing from top level moves them somewhere you are not, so
        // without this the only visible effect is a card gaining a new cover.
        if (!groupId || groupId === activeGroupId) return
        const name = groups.groups.find((g) => g.id === groupId)?.name
        if (name) toast(`Uploaded to ${name}`)
      })
    },
    [uploadFilesRaw, activeGroupId, groups.groups, prefs],
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
      // Onto the front, and nothing leaves. Adding is its own feedback -- the
      // strip visibly gains an image -- so this says nothing.
      //
      // It used to toast when the push evicted the last image, which was the
      // half worth reporting because losing one is invisible. Nothing has
      // evicted since #341 (`pushRef`), and the toast outlived it: it fired
      // whenever the set was at `maxRefImages`, telling you an image had
      // dropped while it was still on screen. Found by #472's sweep.
      generator.pushRefImage({
        id: img.id,
        url: imageUrl(img.id),
        title: img.title,
      })
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

  /**
   * Put a past generation back in the panel: prompt, reference images, aspect
   * ratio (#382). The model selection is deliberately untouched -- see
   * `load-generation.action.ts` for why, and for the three ways this differs
   * from a retry.
   *
   * Nothing is submitted and no row is touched. It fills a form.
   */
  const loadIntoPanel = useCallback(
    async (img: SavedAiImage) => {
      dock.setOpen(true)
      try {
        const loaded = await loadGeneration(img.id)

        // The whole list, not row 0. `setPrompt` writes prompts[0] and leaves
        // the rest, which was invisible until the panel routinely held several
        // -- a Variations run loads four (#436), so Load used to leave you with
        // five prompts and Generate ran all of them. The panel is a single
        // working surface; a past generation merged into a half-written list is
        // a run nobody can read (#458).
        generator.replacePrompts([loaded.prompt])
        generator.replaceRefImages(
          loaded.images.map((i) => ({
            id: i.id,
            url: imageUrl(i.id),
            title: i.title,
          })),
        )

        // Only when the set came back empty. With images, `useGenerator`
        // derives orientation and ratio from slot 0 the moment the set lands
        // (#297) -- the same derivation that chose the ratio when this
        // generation was first made, so it arrives at the same answer and
        // setting it here would only be a race we lose. With no images nothing
        // else will, so the stored value is all there is.
        if (loaded.images.length === 0 && loaded.aspectRatio) {
          const [w, h] = loaded.aspectRatio.split(':').map(Number)
          if (w && h) {
            const orientation = w / h >= 1 ? 'landscape' : 'portrait'
            if (getRatioOptions(orientation).includes(loaded.aspectRatio)) {
              generator.setOrientation(orientation)
              generator.setAspectRatio(loaded.aspectRatio)
            }
          }
        }

        // Said out loud, because a set that comes back short is a generation
        // you would otherwise repeat wrongly. Trashed counts as missing here:
        // restoring an image is a deliberate act, not something Load does for
        // you.
        if (loaded.missing > 0) {
          toast(
            loaded.missing === 1
              ? 'One image from that generation is no longer available'
              : `${loaded.missing} images from that generation are no longer available`,
          )
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Could not load that generation',
        )
      }
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

  return {
    images,
    cells,
    gallery,
    groups,
    workingByGroup,
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
    viewer,
    addReference,
    usePromptText,
    loadIntoPanel,
    animate,
    error,
    setError,
  }
}
