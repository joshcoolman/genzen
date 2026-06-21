import type { CanvasImage, PersistedState } from '../types'
import { supabase } from '@/lib/supabase'
import { createImageStorage } from '@/lib/image-storage'

const DEFAULT_DB = 'moodboard'
const STORE_NAME = 'state'
const DEFAULT_KEY = 'canvas'

/**
 * Images worth loading back: anything with a `recordId`. Completed images carry
 * a storagePath; in-flight generations are pending placeholders (recordId set,
 * no storagePath); failed tiles carry failed/errorMessage/model. Old-format
 * images (src data URL, no recordId) are dropped. Pure -- unit-tested.
 */
export function filterLoadedImages(
  images: Array<CanvasImage>,
): Array<CanvasImage> {
  return images.filter((img) => img.recordId)
}

/**
 * Images worth persisting + their persisted shape. Same membership rule as
 * {@link filterLoadedImages}; only the runtime-only `signedUrl` is stripped, so
 * pending placeholders and failed tiles (with model + error) survive reload.
 * Pure -- unit-tested. This is the durability contract: changing what's kept
 * here can silently lose in-flight or failed generations on navigation.
 */
export function cleanImagesForSave(
  images: Array<CanvasImage>,
): Array<CanvasImage> {
  return filterLoadedImages(images).map(
    ({ signedUrl: _signedUrl, ...rest }) => rest,
  )
}

function openDB(dbName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function loadPersistedState(
  storageKey = DEFAULT_KEY,
  dbName = DEFAULT_DB,
): Promise<PersistedState | null> {
  try {
    const db = await openDB(dbName)
    const raw = await new Promise<PersistedState | null>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(storageKey)
      req.onsuccess = () => resolve(req.result ?? null)
      req.onerror = () => resolve(null)
    })
    if (!raw) return null

    return {
      ...raw,
      images: filterLoadedImages(raw.images),
    }
  } catch {
    return null
  }
}

export async function savePersistedState(
  state: PersistedState,
  storageKey = DEFAULT_KEY,
  dbName = DEFAULT_DB,
) {
  try {
    const db = await openDB(dbName)
    const tx = db.transaction(STORE_NAME, 'readwrite')

    tx.objectStore(STORE_NAME).put(
      { ...state, images: cleanImagesForSave(state.images) },
      storageKey,
    )
  } catch {
    /* silent fail */
  }
}

/** Fetch a full-res signed URL for a Supabase storage path (24h TTL) */
export async function getSignedUrl(
  storagePath: string,
): Promise<string | null> {
  return createImageStorage(supabase).getUrl(storagePath)
}

/** Batch-fetch signed URLs for canvas images that need them */
export async function resolveSignedUrls(
  images: Array<CanvasImage>,
): Promise<Array<CanvasImage>> {
  return Promise.all(
    images.map(async (img) => {
      if (img.signedUrl || !img.storagePath) return img
      const signedUrl = await getSignedUrl(img.storagePath)
      return signedUrl ? { ...img, signedUrl } : img
    }),
  )
}

/**
 * Sync on_canvas flags to Supabase.
 * Compares the current canvas recordIds against what Supabase thinks is on canvas,
 * then flips only the changed rows. Runs in the background alongside IndexedDB saves.
 */
let lastSyncedIds: Set<string> = new Set()

export async function syncCanvasFlags(canvasImages: Array<CanvasImage>) {
  const currentIds = new Set(
    canvasImages
      .filter((img) => img.recordId && !img.pending)
      .map((img) => img.recordId),
  )

  // Diff against last synced state to avoid redundant writes
  const toAdd = [...currentIds].filter((id) => !lastSyncedIds.has(id))
  const toRemove = [...lastSyncedIds].filter((id) => !currentIds.has(id))

  if (toAdd.length === 0 && toRemove.length === 0) return

  const promises: Array<Promise<unknown>> = []

  if (toAdd.length > 0) {
    promises.push(
      supabase
        .from('user_images')
        .update({ on_canvas: true })
        .in('id', toAdd) as unknown as Promise<unknown>,
    )
  }

  if (toRemove.length > 0) {
    promises.push(
      supabase
        .from('user_images')
        .update({ on_canvas: false })
        .in('id', toRemove) as unknown as Promise<unknown>,
    )
  }

  await Promise.allSettled(promises)
  lastSyncedIds = currentIds
}

/** Get image dimensions from a File using an object URL (fast, no base64) */
export function getImageDimensions(
  file: File,
): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ w: img.naturalWidth, h: img.naturalHeight })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve({ w: 300, h: 300 })
    }
    img.src = url
  })
}

/** Get natural dimensions of an already-hosted image URL (for DB reconciliation).
 *  Falls back to a default after a timeout so a hung load can't stall the
 *  reconcile's Promise.all indefinitely. */
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
 * Eagerly flip the on_canvas membership flag for specific records. Used the moment
 * an image joins (true) or leaves (false) the canvas so the DB is always an
 * accurate basis for recovery -- not waiting on the debounced syncCanvasFlags.
 * Fire-and-forget; never throws.
 */
export async function setOnCanvas(recordIds: Array<string>, value: boolean) {
  const ids = recordIds.filter(Boolean)
  if (ids.length === 0) return
  try {
    await supabase
      .from('user_images')
      .update({ on_canvas: value })
      .in('id', ids)
  } catch {
    /* silent fail -- syncCanvasFlags will reconcile on the next save */
  }
}

/**
 * Soft-delete (move to Trash) the given user_images rows by setting `deleted_at`.
 * Callers must already have removed the images from the canvas (`on_canvas = false`)
 * so Trash's linked-image protection doesn't apply. Only affects rows not already
 * trashed. Returns the ids that were trashed (for optimistic UI / undo messaging).
 */
export async function moveToTrash(recordIds: Array<string>): Promise<void> {
  const ids = recordIds.filter(Boolean)
  if (ids.length === 0) return
  await supabase
    .from('user_images')
    .update({ deleted_at: new Date().toISOString() })
    .in('id', ids)
    .is('deleted_at', null)
}

/**
 * Undo a `moveToTrash`: clear `deleted_at` and re-mark the rows on-canvas.
 * Pairs with the "Move to Trash" Undo action so a deliberate trash is reversible.
 */
export async function restoreFromTrash(
  recordIds: Array<string>,
): Promise<void> {
  const ids = recordIds.filter(Boolean)
  if (ids.length === 0) return
  await supabase
    .from('user_images')
    .update({ deleted_at: null, on_canvas: true })
    .in('id', ids)
}

export interface CanvasDbRecord {
  id: string
  storage_path: string | null
  status: string | null
  generation_metadata: Record<string, unknown> | null
}

/** Fetch every image the DB considers on-canvas (source of truth for membership) */
export async function fetchOnCanvasRecords(
  userId: string,
): Promise<Array<CanvasDbRecord>> {
  try {
    const { data } = await supabase
      .from('user_images')
      .select('id, storage_path, status, generation_metadata')
      .eq('user_id', userId)
      .eq('on_canvas', true)
      .is('deleted_at', null)
    return (data as Array<CanvasDbRecord> | null) ?? []
  } catch {
    return []
  }
}

/**
 * Of the given record ids, return those that are gone -- hard-deleted (row
 * missing) or soft-deleted (deleted_at set). Used to prune dead images from the
 * canvas without ever dropping a live one (e.g. an arrangement whose on_canvas
 * flag was never written).
 */
export async function fetchDeadRecordIds(
  ids: Array<string>,
): Promise<Set<string>> {
  const list = ids.filter(Boolean)
  if (list.length === 0) return new Set()
  try {
    const { data } = await supabase
      .from('user_images')
      .select('id, deleted_at')
      .in('id', list)
    const alive = new Set(
      ((data as Array<{ id: string; deleted_at: string | null }> | null) ?? [])
        .filter((r) => !r.deleted_at)
        .map((r) => r.id),
    )
    return new Set(list.filter((id) => !alive.has(id)))
  } catch {
    return new Set()
  }
}
