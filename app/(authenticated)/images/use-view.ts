'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useHotkey } from '@tanstack/react-hotkeys'
import { useDock } from './_hooks/use-dock'
import { useDownload } from './_hooks/use-download'
import { useReferenceSheet } from './_hooks/use-reference-sheet'
import { usePrefs } from './_hooks/use-prefs'
import { useUploads } from './_hooks/use-uploads'
import { useGallery } from './_hooks/use-gallery'
import { useImageViewer } from './_hooks/use-image-viewer'
import type {
  GroupWrite,
  ImageGroupSummary,
} from '#/features/groups/hooks/use-groups'
import type { GalleryCell } from './_components/image-gallery/image-gallery'
import type { SavedAiImage } from '#/features/ai-images/types'
import { useVisibility } from '#/features/visibility/hooks/use-visibility'
import { useGroups } from '#/features/groups/hooks/use-groups'
import { loadGeneration } from '#/features/ai-images/server/load-generation.action'
import { generateImage } from '#/features/ai-images/server/generate-image.action'
import {
  buildOutpaintPrompt,
  outpaintModelId,
} from '#/features/ai-images/outpaint'
import {
  writeShot,
  writeShotScene,
} from '#/features/ai-images/server/write-shot-prompt.action'
import { findShot } from '#/lib/prompts/shots'
import {
  writeLighting,
  writeLightingSubject,
} from '#/features/ai-images/server/write-lighting-prompt.action'
import { findLightingEffect } from '#/lib/prompts/lighting'
import { getModelName } from '#/features/ai-images/models'
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

  const groups = useGroups('image')
  const activeGroup = groups.groups.find((g) => g.id === activeGroupId) ?? null
  /** The open group renders in its hand-set order (#505). Only ever true
   *  inside a group -- at top level there is one order and it is the
   *  library's. */
  const manualOrder = Boolean(activeGroup?.manual_order)

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

  const prefs = usePrefs()

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

  /**
   * **Where you are standing, as a predicate, with visibility left out of it**
   * (#546).
   *
   * The wall is this and then `visibility.visible`; the hidden bar is this and
   * then the opposite. Splitting the scope out of the filter is what lets the
   * bar count what is hidden *here* -- it is asked of hidden rows, so it must
   * not know about hiding, or it would answer no to every one of them.
   *
   * Origin is part of it, because the bar's promise is "this is what comes
   * back if you press Show". Under `Uploads`, a hidden generation coming back
   * would land somewhere you are not looking, so it is not this bar's business
   * either.
   */
  const inScope = useCallback(
    (img: SavedAiImage) => {
      if (activeGroupId) return img.group_id === activeGroupId
      if (uploadsIgnoreGroups) return img.origin === 'upload'
      if (img.group_id) return false
      if (prefs.originFilter === 'all') return true
      return img.origin === prefs.originFilter
    },
    [activeGroupId, uploadsIgnoreGroups, prefs.originFilter],
  )

  // What the grid is allowed to draw (#504): hidden rows, and the focus
  // spotlight. Sits above the scope filter below rather than inside it,
  // because it applies inside a group and at top level alike.
  //
  // It is handed `inScope` and every row, not the scoped rows: the wall wants
  // both filters, the bar wants the scope without the hiding, and the group
  // cards want neither (#546).
  const visibility = useVisibility({
    rows: gallery.images,
    patch: (ids, hiddenAt) => gallery.patchImages(ids, { hidden_at: hiddenAt }),
    inScope,
  })
  const userImages = useUserImages(user.id)
  const dock = useDock()
  const download = useDownload()
  // Selection-based, not group-based (#476): a sheet is made of whatever is
  // picked, wherever it was picked.
  const referenceSheet = useReferenceSheet()

  /**
   * Zipping the selection (#480). Its own flag rather than a `groupFlow` kind:
   * the scope is the selection, which exists at top level and across groups,
   * so there is no group to carry.
   */
  const [zipSelectionOpen, setZipSelectionOpen] = useState(false)

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
  const workingByGroup = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const img of gallery.images) {
      if (!img.group_id || img.status !== 'pending') continue
      counts[img.group_id] = (counts[img.group_id] ?? 0) + 1
    }
    return counts
  }, [gallery.images])

  /**
   * How many of each group's images are hidden -- the other half of #546.
   *
   * Once the bar counts only what is hidden *here*, an image hidden inside a
   * group is invisible from top level with nothing anywhere saying so, which
   * is the "hidden state you cannot see is a slower kind of lost" failure #504
   * built the bar to prevent, reintroduced one level down. The group card says
   * it instead, in the line that already reports what the group is doing.
   *
   * Arithmetic on rows in hand, exactly like `workingByGroup` above: no read,
   * and it tracks a hide on the frame the card leaves.
   */
  const hiddenByGroup = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const img of gallery.images) {
      if (!img.group_id || !img.hidden_at) continue
      counts[img.group_id] = (counts[img.group_id] ?? 0) + 1
    }
    return counts
  }, [gallery.images])

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

  // Group first, then scope, then order. The filter is client-side on purpose:
  // the gallery already holds every row, so switching scopes is instant and
  // costs no round trip -- and `origin` is immutable, so a filtered-out row
  // cannot become stale.
  //
  // Inside a group there is no origin filtering at all -- the group is already
  // the scope, and two scoping controls stacked on each other only raise the
  // question of which one wins.
  const scoped = useMemo(() => {
    // Visibility first (#504), so every branch below inherits it and none can
    // forget: a hidden image is hidden inside a group, at top level, and under
    // every scope. A per-branch filter would be four places to keep in step.
    const shown = gallery.images.filter(
      (img) => visibility.visible(img) && inScope(img),
    )
    if (activeGroupId) {
      if (!manualOrder) return shown
      /* Ascending, nulls last, then oldest first among the nulls -- which is
         the whole of "a new image lands at the end" (#505). Nothing writes a
         position when a row joins a group, on any of the three paths that put
         one there; an unpositioned row simply sorts after every positioned
         one, and the next drag gives it a number along with everything else. */
      return [...shown].sort((a, b) => {
        const ap = a.group_position ?? Infinity
        const bp = b.group_position ?? Infinity
        if (ap !== bp) return ap - bp
        return (
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
      })
    }
    return shown
  }, [gallery.images, visibility.visible, inScope, activeGroupId, manualOrder])

  /* The arrangement is the order, so the toolbar's newest/oldest toggle does
     not apply to it (#505) -- and the toolbar hides that control inside an
     arranged group rather than leaving it there doing nothing. */
  const images = prefs.sortAsc && !manualOrder ? [...scoped].reverse() : scoped

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
    /* An arranged group is already in its order, and there are no group cards
       inside a group to interleave with it -- so the sort below has nothing to
       decide and would only undo the arrangement. */
    if (manualOrder) {
      return scoped.map((image) => ({ kind: 'image' as const, image }))
    }
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
            // The swatches are filtered here rather than in the read that
            // builds them (#504). A hidden image showing on a group card is
            // exactly the "I hid this and can still see it" case, and doing it
            // client-side is what makes the swatches track Show hidden -- a
            // server filter would leave them stale the moment it is toggled.
            //
            // `count` is deliberately untouched: it is a fact about the group,
            // not a description of what is on screen, and a card reporting 8
            // because 4 are hidden would be a different group every time the
            // toggle moved.
            cell: {
              kind: 'group' as const,
              group: {
                ...group,
                preview_image_ids: group.preview_image_ids.filter(
                  (id) => !visibility.withheldIds.has(id),
                ),
              },
            },
            sortOrder: group.sort_order,
          }))

    const ordered = [...groupCells, ...imageCells].sort(
      (a, b) => b.sortOrder - a.sortOrder,
    )
    const cellsDesc = ordered.map((o) => o.cell)
    return prefs.sortAsc ? cellsDesc.reverse() : cellsDesc
  }, [
    scoped,
    groups.groups,
    visibility.withheldIds,
    activeGroupId,
    uploadsIgnoreGroups,
    prefs.sortAsc,
    manualOrder,
  ])

  // The expanded group strip (#352), minus anything hidden (#504).
  const visibleGroupMembers = useMemo(() => {
    if (visibility.withheldIds.size === 0) return groups.members
    const out: Record<string, Array<string>> = {}
    for (const [groupId, ids] of Object.entries(groups.members)) {
      out[groupId] = ids.filter((id) => !visibility.withheldIds.has(id))
    }
    return out
  }, [groups.members, visibility.withheldIds])

  // The list the grid renders, minus the cards with nothing to look at (#270).
  // Scoped and sorted exactly like the grid -- inside a group that is the
  // group's images -- because "next" has to mean the next picture on screen.
  // A viewer cycling a different list sends you somewhere you were not looking.
  const viewerImages = useMemo(
    () => images.filter((img) => img.status === 'completed'),
    [images],
  )

  /* Delete and its safe twin, both stepping on through the set (#545). The
     hide is `visibility.hide` unchanged -- the row leaves the grid, so it
     leaves this list, which is the same shrink a delete causes. */
  const viewer = useImageViewer(
    viewerImages,
    gallery.deleteImage,
    (img) => void visibility.hide([img.id]),
  )

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

  /**
   * The drawer's Hide and Focus (#504).
   *
   * Both leave select mode, as every batch action does: the selection named
   * the set, the set is now the view, and staying in the mode leaves ticks on
   * cards you just finished acting on.
   *
   * Focus does *not* hide anything -- it is a spotlight, and the images it
   * excludes are untouched. So it is the reversible one of the pair, and its
   * way out is the strip under the grid rather than an undo.
   */
  const hideSelected = useCallback(async () => {
    const ids = images
      .filter((img) => selection.selectedIds.has(img.id))
      .map((img) => img.id)
    selection.clearSelection()
    await visibility.hide(ids)
  }, [images, selection, visibility])

  const focusSelected = useCallback(() => {
    const ids = images
      .filter((img) => selection.selectedIds.has(img.id))
      .map((img) => img.id)
    selection.clearSelection()
    visibility.focusOn(ids)
  }, [images, selection, visibility])

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
   * The drop at the end of a reorder drag (#505).
   *
   * Optimistic in the half that matters: the grid holds the new order in the
   * same tick, because the client already knows the sequence it just built --
   * there is nothing to ask the server for. The write persists it and returns
   * the group summary, which is where `manual_order` flipping to true arrives.
   *
   * The whole ordered list every time, not the one image that moved: every
   * member needs a number for the arrangement to be total, since an unnumbered
   * row sorts after every numbered one. It is one statement either way.
   */
  const reorderGroupImages = useCallback(
    async (orderedIds: Array<string>) => {
      if (!activeGroupId) return
      gallery.setGroupPositions(orderedIds)
      applyGroupWrite(await groups.reorder(activeGroupId, orderedIds))
    },
    [activeGroupId, gallery, groups, applyGroupWrite],
  )

  /**
   * Newest first, or the arrangement (#505).
   *
   * Free in both directions: turning the arrangement off keeps every position,
   * so this is a way of looking at the group rather than a way of throwing
   * work away. That is why the control can stay a plain toggle with no confirm
   * on it.
   */
  const setGroupOrderMode = useCallback(
    async (manual: boolean) => {
      if (!activeGroupId) return
      applyGroupWrite(await groups.setOrderMode(activeGroupId, manual))
    },
    [activeGroupId, groups, applyGroupWrite],
  )

  /**
   * A pasted image onto the front of the reference strip (#491).
   *
   * Shared with `addReference` below (Cmd-click on a card), which is the same
   * act from a picture that already exists. Both open the panel: a power move
   * whose entire effect is inside a closed panel has no feedback at all.
   */
  const pushReference = useCallback(
    (image: { id: string; title: string }) => {
      // Refusing out loud: the strip is disabled only when the selected model
      // takes no images at all, and a gesture that reports nothing and adds
      // nothing is worse than one that says no.
      if (generator.maxRefImages === 0) {
        toast('The selected model does not take images')
        return
      }
      dock.setOpen(true)
      // Onto the front, and nothing leaves. Adding is its own feedback -- the
      // strip visibly gains an image -- so this says nothing.
      generator.pushRefImage({
        id: image.id,
        url: imageUrl(image.id),
        title: image.title,
      })
    },
    [generator, dock],
  )

  /**
   * **A paste uploads and stops there** (#550) -- it no longer also makes the
   * image the reference. The panel's library picker is the deliberate route to
   * a reference now (#489), and the pasted cards are on screen, so selecting
   * them is the next move rather than something that already happened to you.
   *
   * The open group is the destination. At top level `activeGroupId` is null and
   * the image lands loose; inside a group it lands in it, with no dialog -- a
   * group is a focus session, and asking which group you meant while you are
   * standing in one is ceremony (#348).
   */
  const { uploadFiles } = useUploads(user.id, gallery, activeGroupId, {
    // Same rule as a generation: an upload while scoped to Generations would
    // land somewhere the grid is not showing.
    onStart: prefs.revealAll,
  })

  /**
   * **The Upload button's files, offered only where the route is about the
   * library rather than about a generation** (#550): scoped to Uploads, or
   * inside a group. #491's objection to a button was "a second route to the
   * same thing, further from the work" -- true of one always present and
   * competing with the panel's picker, not of one that appears when you have
   * said you are filing rather than feeding.
   */
  const canUpload = Boolean(activeGroupId) || prefs.originFilter === 'uploads'

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
      pushReference({ id: img.id, title: img.title })
    },
    [pushReference],
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

  /**
   * Outpaint (#430): reframe one picture into one or more other shapes.
   *
   * **A side errand, not a change of context.** Nothing here touches the
   * panel, the reference set or the model selection -- the whole gesture is
   * "this picture, these shapes, go", and the results arrive in the grid like
   * any other generation. That is the difference from Load, which exists to
   * put you back in the middle of a past setup.
   *
   * Submitted one after another rather than together, as the lab and Video do:
   * each call reserves a row before it reaches FAL, and firing them at once
   * interleaves the reservations against a queue that answers in its own
   * order. Optimistic cards go up first so a press with four shapes shows four
   * tiles immediately, and each is swapped for its real row or dropped on the
   * spot -- the same contract `useGenerator` has with `onSubmitOutcome`.
   */
  /**
   * Shots (#553): every staged reference, from every angle picked, one
   * generation each.
   *
   * **Each submit carries exactly one picture.** `sourceImageId` and nothing
   * else -- no `referenceImageIds` -- because two references in one request is
   * the combine the generator panel already does, and this is the opposite
   * errand: the same treatment applied to each subject separately. Two
   * characters and two angles is four rows, not one.
   *
   * The loop is `runOutpaint`'s, for the reasons written there: optimistic
   * cards first so the press shows its full count immediately, then submitted
   * one after another rather than together, because each call reserves a row
   * before it reaches FAL.
   *
   * **A failure drops its own card and keeps going.** Sixteen angles across
   * three references is forty-eight submits, and stopping the run on the first
   * refusal would throw away the forty-seven that would have worked. That
   * covers the enhanced path's extra failure too: a prompt the writer could not
   * produce loses its own tile and nothing else.
   *
   * **The scene is written once per picture, before any submit.** That is the
   * whole of `scene-shot`: sixteen angles sharing one paragraph of scene, so
   * the light and colour cannot differ between them. A picture whose scene
   * cannot be written loses all of its tiles at once and the run continues with
   * the others -- there is nothing to submit for it, and pretending otherwise
   * would spend money on the drift this mode exists to remove.
   */
  const [shotsOpen, setShotsOpen] = useState(false)

  const runShots = useCallback(
    async (
      imageIds: Array<string>,
      shotIds: Array<string>,
      model: string,
      instructions: string,
    ) => {
      if (imageIds.length === 0 || shotIds.length === 0) return

      // Making something is an implicit request to see it (#444).
      prefs.revealAll()

      const stamp = Date.now()
      const pairs = imageIds.flatMap((imageId) =>
        shotIds.map((shotId) => ({
          imageId,
          shotId,
          placeholderId: `shot-${imageId}-${shotId}-${stamp}`,
        })),
      )

      for (const pair of pairs) {
        gallery.addOptimisticCard(
          pendingCard(
            {
              placeholderId: pair.placeholderId,
              model,
              title: getModelName(model),
              prompt: findShot(pair.shotId)?.label ?? pair.shotId,
              sourceImageId: pair.imageId,
            },
            activeGroupId,
          ),
        )
      }

      // Closed here, on the cards rather than on the run (#563). Everything
      // below is network -- a vision call per picture and a submit per frame --
      // and a dialog held open across it reads as a press that did not land.
      // The tiles are already on the wall by this line, which is the app's
      // answer to "what is happening" everywhere else; a failure below takes
      // its own card away and says so, and it can say so from behind a closed
      // dialog exactly as well.
      setShotsOpen(false)

      // One scene per picture, reused by every angle of it. Written before the
      // submits rather than lazily inside the loop so a bad key or an
      // unreadable object fails once, loudly, instead of sixteen times.
      const scenes = new Map<string, string>()
      for (const imageId of imageIds) {
        try {
          const { scene } = await writeShotScene({ imageId, instructions })
          scenes.set(imageId, scene)
        } catch (err) {
          for (const p of pairs.filter((x) => x.imageId === imageId)) {
            gallery.removeOptimisticCard(p.placeholderId)
          }
          toast.error(
            err instanceof Error
              ? err.message
              : 'Could not write the scene for one of the pictures',
          )
        }
      }

      for (const pair of pairs) {
        const label = findShot(pair.shotId)?.label ?? pair.shotId
        const scene = scenes.get(pair.imageId)
        if (!scene) continue
        try {
          const { prompt } = await writeShot({
            imageId: pair.imageId,
            shotId: pair.shotId,
            scene,
            instructions,
          })
          const created = await generateImage({
            prompt,
            model,
            origin: 'images',
            sourceImageId: pair.imageId,
            groupId: activeGroupId,
          })
          gallery.replaceOptimisticCard(pair.placeholderId, (card) => ({
            ...card,
            id: created.recordId,
          }))
        } catch (err) {
          gallery.removeOptimisticCard(pair.placeholderId)
          toast.error(err instanceof Error ? err.message : `${label} failed`)
        }
      }

      void gallery.refresh({ silent: true })
      void groups.refresh()
    },
    [gallery, groups, prefs, activeGroupId],
  )

  /**
   * Lighting (#563): every staged reference, under every light picked, through
   * every model picked -- one generation each.
   *
   * `runShots`' loop with the writer taken out. The prompt is the wrapper plus
   * the effect, both fixed text, so there is nothing to ask a model before
   * asking for the picture -- which also means a pair cannot fail before it
   * reaches FAL the way a shot can when its scene will not write.
   *
   * **The prompt is written in two passes, like Shots'**, and for a reason the
   * action's header holds: an effect describes a lighting setup for any
   * subject, and something has to bind it to this one. `writeLightingSubject`
   * runs once per picture and `writeLighting` once per effect on top of it, so
   * a picture whose inventory cannot be written loses all of its tiles at once
   * and the run carries on with the others.
   *
   * **The third multiplication is the models**, where Shots has one. A relight
   * is a single picture you compare, so putting one subject through four models
   * in one press is the useful gesture; a sixteen-frame shot set is a thing you
   * look at whole, and crossing it by models would be sixty-four.
   *
   * Everything else holds for the same reasons written on `runShots`: one
   * picture per submit and never `referenceImageIds`, because two references in
   * one request is the combine the panel already does; optimistic cards up
   * front so the press shows its full count; submitted one after another
   * because each call reserves a row before it reaches FAL; and a failure drops
   * its own card and lets the rest of the run finish.
   */
  const [lightingOpen, setLightingOpen] = useState(false)

  const runLighting = useCallback(
    async (
      imageIds: Array<string>,
      effectIds: Array<string>,
      models: Array<string>,
    ) => {
      if (
        imageIds.length === 0 ||
        effectIds.length === 0 ||
        models.length === 0
      )
        return

      // Making something is an implicit request to see it (#444).
      prefs.revealAll()

      const stamp = Date.now()
      const pairs = imageIds.flatMap((imageId) =>
        effectIds.flatMap((effectId) =>
          models.map((model) => ({
            imageId,
            effectId,
            model,
            placeholderId: `light-${imageId}-${effectId}-${model}-${stamp}`,
          })),
        ),
      )

      for (const pair of pairs) {
        gallery.addOptimisticCard(
          pendingCard(
            {
              placeholderId: pair.placeholderId,
              model: pair.model,
              title: getModelName(pair.model),
              prompt: findLightingEffect(pair.effectId)?.label ?? pair.effectId,
              sourceImageId: pair.imageId,
            },
            activeGroupId,
          ),
        )
      }

      // Closed on the cards, not on the run -- see `runShots`.
      setLightingOpen(false)

      // One inventory per picture, reused by every effect and every model of
      // it. Written before the submits rather than lazily inside the loop so an
      // unreadable object fails once, loudly, instead of once per pair.
      const subjects = new Map<string, string>()
      for (const imageId of imageIds) {
        try {
          const { subject } = await writeLightingSubject({ imageId })
          subjects.set(imageId, subject)
        } catch (err) {
          for (const p of pairs.filter((x) => x.imageId === imageId)) {
            gallery.removeOptimisticCard(p.placeholderId)
          }
          toast.error(
            err instanceof Error
              ? err.message
              : 'Could not read one of the pictures',
          )
        }
      }

      // Written once per picture-and-effect, not per pair: the models differ in
      // what they do with a prompt, not in what it should say, so writing it
      // again for each would be one Claude call per model to arrive at the same
      // paragraph.
      const prompts = new Map<string, string>()

      for (const pair of pairs) {
        const label = findLightingEffect(pair.effectId)?.label ?? pair.effectId
        const subject = subjects.get(pair.imageId)
        if (!subject) continue
        const key = `${pair.imageId}:${pair.effectId}`
        try {
          if (!prompts.has(key)) {
            const { prompt } = await writeLighting({
              imageId: pair.imageId,
              effectId: pair.effectId,
              subject,
            })
            prompts.set(key, prompt)
          }
          const created = await generateImage({
            prompt: prompts.get(key)!,
            model: pair.model,
            origin: 'images',
            sourceImageId: pair.imageId,
            groupId: activeGroupId,
          })
          gallery.replaceOptimisticCard(pair.placeholderId, (card) => ({
            ...card,
            id: created.recordId,
          }))
        } catch (err) {
          gallery.removeOptimisticCard(pair.placeholderId)
          toast.error(err instanceof Error ? err.message : `${label} failed`)
        }
      }

      void gallery.refresh({ silent: true })
      void groups.refresh()
    },
    [gallery, groups, prefs, activeGroupId],
  )

  const [outpaintTarget, setOutpaintTarget] = useState<SavedAiImage | null>(
    null,
  )
  const [outpainting, setOutpainting] = useState(false)

  const runOutpaint = useCallback(
    async (ratios: Array<string>) => {
      const source = outpaintTarget
      if (!source || ratios.length === 0) return
      const model = outpaintModelId()

      setOutpainting(true)
      // Making something is an implicit request to see it (#444).
      prefs.revealAll()

      const placeholders = ratios.map((ratio) => ({
        ratio,
        placeholderId: `outpaint-${source.id}-${ratio}-${Date.now()}`,
      }))
      for (const p of placeholders) {
        gallery.addOptimisticCard(
          pendingCard(
            {
              placeholderId: p.placeholderId,
              model,
              title: getModelName(model),
              prompt: `Outpaint to ${p.ratio}`,
              sourceImageId: source.id,
            },
            activeGroupId,
          ),
        )
      }

      for (const p of placeholders) {
        try {
          const created = await generateImage({
            prompt: buildOutpaintPrompt(p.ratio),
            model,
            origin: 'images',
            aspectRatio: p.ratio,
            sourceImageId: source.id,
            groupId: activeGroupId,
          })
          gallery.replaceOptimisticCard(p.placeholderId, (card) => ({
            ...card,
            id: created.recordId,
          }))
        } catch (err) {
          gallery.removeOptimisticCard(p.placeholderId)
          toast.error(
            err instanceof Error
              ? err.message
              : `Outpaint to ${p.ratio} failed`,
          )
        }
      }

      setOutpainting(false)
      setOutpaintTarget(null)
      void gallery.refresh({ silent: true })
      void groups.refresh()
    },
    [outpaintTarget, gallery, groups, prefs, activeGroupId],
  )

  return {
    images,
    cells,
    gallery,
    groups,
    workingByGroup,
    hiddenByGroup,
    visibleGroupMembers,
    activeGroup,
    manualOrder,
    reorderGroupImages,
    setGroupOrderMode,
    /* Whether an arrangement *exists*, which is a different question from
       whether it is in effect (#505). Derived from the rows in hand rather
       than stored, and only meaningful inside a group -- which is the only
       place the control that reads it renders. */
    hasManualOrder: scoped.some((img) => img.group_position != null),
    activeGroupId,
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
    moveGroup,
    dissolveGroup,
    trashGroup,
    setGroupCoverImage,
    userImages,
    modelSelector,
    generator,
    /** The Upload button, offered only where the route is about the library
     *  (#550). Undefined is what hides the control. */
    uploadFiles: canUpload ? uploadFiles : undefined,
    prefs,
    dock,
    download,
    referenceSheet,
    zipSelectionOpen,
    setZipSelectionOpen,
    selection,
    selectMode,
    visibility,
    hideSelected,
    focusSelected,
    isBatchDeleting,
    deleteSelected,
    viewer,
    addReference,
    usePromptText,
    loadIntoPanel,
    outpaintTarget,
    startOutpaint: setOutpaintTarget,
    cancelOutpaint: useCallback(() => setOutpaintTarget(null), []),
    outpainting,
    runOutpaint,
    shotsOpen,
    openShots: useCallback(() => setShotsOpen(true), []),
    closeShots: useCallback(() => setShotsOpen(false), []),
    runShots,
    lightingOpen,
    openLighting: useCallback(() => setLightingOpen(true), []),
    closeLighting: useCallback(() => setLightingOpen(false), []),
    runLighting,
    error,
    setError,
  }
}
