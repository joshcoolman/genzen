import {
  addImagesToCanvas,
  removeImagesFromCanvas,
  restoreCanvasImages,
  saveCanvasState,
  trashCanvasImages,
} from '../_actions/canvas'
import type { CanvasGroup, CanvasImage, Transform } from './types'
import type { CanvasMemberRecord, CanvasState } from '../_actions/canvas'

// Fail-safe wrappers over `_actions/canvas.ts`, plus the pure mapping between a
// membership row and a canvas card.
//
// There is no IndexedDB here any more (#212). Arrangement is user data: it now
// lives in `canvas_images`, which is why it survives a different browser and a
// different machine. Nothing in this file caches -- the server read seeds the
// view and the debounced save writes back.
//
// The wrappers swallow failures on purpose, for the same reason they always did:
// a membership write that cannot reach the server must not take the card off the
// screen. What is gone is the reconcile that failure used to feed -- with a
// foreign key and a uniqueness constraint there is nothing left to prune or
// dedupe, only *place what is unplaced*.

/**
 * Images worth keeping: anything with a `recordId`. A card without one is a
 * local upload placeholder whose `user_images` row has not returned yet, so
 * there is no membership row to write a position to.
 */
export function filterLoadedImages(
  images: Array<CanvasImage>,
): Array<CanvasImage> {
  return images.filter((img) => img.recordId)
}

/**
 * A membership row as a canvas card. `id` is the image id: `unique (canvas_id,
 * image_id)` makes it a stable canvas-local identity, so a card keeps the same
 * id across loads and a saved group still names the right images.
 *
 * Position may be absent -- an unplaced row, which the caller lays out. Width
 * and height are 0 in that case rather than guessed here, so the placement pass
 * is the only thing that decides size. Pure -- unit-tested.
 */
export function memberToImage(row: CanvasMemberRecord): CanvasImage {
  const meta = row.generation_metadata ?? {}
  const failed = row.status === 'failed'

  return {
    id: row.image_id,
    recordId: row.image_id,
    storagePath: row.storage_path ?? '',
    x: row.x ?? 0,
    y: row.y ?? 0,
    width: row.width ?? 0,
    height: row.height ?? 0,
    ...(row.status === 'pending' ? { pending: true } : {}),
    ...(failed ? { failed: true } : {}),
    ...(failed && row.generation_error
      ? { errorMessage: row.generation_error }
      : {}),
    ...(typeof meta.model === 'string' ? { model: meta.model } : {}),
    ...(row.url ? { signedUrl: row.url } : {}),
  }
}

/** Whether a row arrived without a position and needs laying out. */
export function isUnplaced(row: CanvasMemberRecord): boolean {
  return row.x === null || row.width === null
}

/** The whole canvas as cards, plus which of them still need a position. */
export function stateToImages(state: CanvasState): {
  images: Array<CanvasImage>
  unplacedIds: Set<string>
} {
  return {
    images: state.images.map(memberToImage),
    unplacedIds: new Set(
      state.images.filter(isUnplaced).map((row) => row.image_id),
    ),
  }
}

/**
 * Groups, with their image ids translated to record ids for storage.
 *
 * Almost always the identity mapping, because a loaded card's `id` *is* its
 * record id. The exception is the one that matters: a group formed in this
 * session over freshly-uploaded cards still holds local placeholder ids, and
 * saving those would produce a group naming images that do not exist on the
 * next load. Members that cannot be resolved are dropped, and a group left with
 * fewer than two goes with them. Pure -- unit-tested.
 */
export function groupsForSave(
  images: Array<CanvasImage>,
  groups: Array<CanvasGroup>,
): Array<CanvasGroup> {
  const recordIdFor = new Map(
    images.filter((img) => img.recordId).map((img) => [img.id, img.recordId]),
  )

  return groups
    .map((group) => ({
      ...group,
      imageIds: group.imageIds
        .map((id) => recordIdFor.get(id))
        .filter((id): id is string => !!id),
    }))
    .filter((group) => group.imageIds.length >= 2)
}

/**
 * The membership rows to write when a removal is undone.
 *
 * Position rides along rather than being left to the next autosave, because
 * `saveCanvasState` writes arrangement and *never* membership -- a row that
 * does not exist cannot be given coordinates, so a restore without these
 * numbers puts the card back unplaced and the load pass re-lays it somewhere
 * else. A card with no `recordId` never had a row to restore. Pure -- unit
 * tested, because the shape of this payload is what #194 got wrong.
 */
export function membersForRestore(images: Array<CanvasImage>) {
  return filterLoadedImages(images).map((img) => ({
    imageId: img.recordId,
    x: img.x,
    y: img.y,
    width: img.width,
    height: img.height,
  }))
}

/** Positions worth writing: placed cards whose row exists. */
export function positionsForSave(images: Array<CanvasImage>) {
  return filterLoadedImages(images)
    .filter((img) => img.width > 0 && img.height > 0)
    .map((img) => ({
      imageId: img.recordId,
      x: img.x,
      y: img.y,
      width: img.width,
      height: img.height,
    }))
}

/**
 * Persist the arrangement. Never a membership write: the set of images on the
 * canvas is changed only by an explicit add or remove, so a save cannot evict a
 * generation that landed server-side while this tab was in the background.
 */
export async function saveCanvas(
  canvasId: string,
  state: {
    images: Array<CanvasImage>
    transform: Transform
    groups: Array<CanvasGroup>
  },
): Promise<void> {
  try {
    await saveCanvasState({
      canvasId,
      transform: state.transform,
      groups: groupsForSave(state.images, state.groups),
      positions: positionsForSave(state.images),
    })
  } catch {
    /* silent fail -- the next debounce tick writes the same state again */
  }
}

/**
 * Put images on the canvas, with their position when it is already known.
 * Fire-and-forget; never throws.
 */
export async function addToCanvas(
  canvasId: string,
  members: Array<{
    imageId: string
    x?: number
    y?: number
    width?: number
    height?: number
  }>,
): Promise<void> {
  const list = members.filter((m) => m.imageId)
  if (list.length === 0) return
  try {
    await addImagesToCanvas(canvasId, list)
  } catch {
    /* silent fail -- the card stays on screen; the next save rewrites position */
  }
}

/** Take images off the canvas. The rows stay in the library. */
export async function removeFromCanvas(
  canvasId: string,
  imageIds: Array<string>,
): Promise<void> {
  const ids = imageIds.filter(Boolean)
  if (ids.length === 0) return
  try {
    await removeImagesFromCanvas(canvasId, ids)
  } catch {
    /* silent fail */
  }
}

/** Get image dimensions from a File using an object URL (fast, no base64) */
export function getImageDimensions(
  file: File,
): Promise<{ w: number; h: number }> {
  return readLocalImage(file).then(({ w, h, url }) => {
    URL.revokeObjectURL(url)
    return { w, h }
  })
}

/**
 * Dimensions *and* the object URL that produced them, so a dropped file can be
 * drawn from local bytes while its upload is still in flight. The caller owns
 * the URL and must revoke it -- `getImageDimensions` is the throwaway variant.
 */
export function readLocalImage(
  file: File,
): Promise<{ w: number; h: number; url: string }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () =>
      resolve({ w: img.naturalWidth, h: img.naturalHeight, url })
    img.onerror = () => resolve({ w: 300, h: 300, url })
    img.src = url
  })
}

/** Resolve once a URL is actually decodable, so swapping a card's `src` from a
 *  local object URL to the hosted one cannot flash an empty frame. */
export function preloadUrl(url: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve()
    img.onerror = () => resolve()
    img.src = url
  })
}

/** Natural dimensions of an already-hosted image URL, for placing an unplaced
 *  row. Falls back after a timeout so one hung load cannot stall the placement
 *  pass's `Promise.all` indefinitely. */
export function getUrlDimensions(
  url: string,
): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (dims: { w: number; h: number }) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(dims)
    }
    const timer = setTimeout(() => finish({ w: 300, h: 300 }), 10000)
    const img = new Image()
    img.onload = () => finish({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => finish({ w: 300, h: 300 })
    img.src = url
  })
}

/**
 * Soft-delete (move to Trash) the given `user_images` rows. Membership is left
 * alone -- restoring puts the card back where it was (#212).
 */
export async function moveToTrash(recordIds: Array<string>): Promise<void> {
  await trashCanvasImages(recordIds)
}

/** Undo a `moveToTrash`: clear `deleted_at`. Membership never went away. */
export async function restoreFromTrash(
  recordIds: Array<string>,
): Promise<void> {
  await restoreCanvasImages(recordIds)
}

export type { CanvasMemberRecord, CanvasState }
