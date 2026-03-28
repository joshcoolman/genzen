import type { CanvasImage, PersistedState } from '../types'
import { supabase } from '@/lib/supabase'
import { createImageStorage } from '@/lib/image-storage'

const DEFAULT_DB = 'moodboard'
const STORE_NAME = 'state'
const DEFAULT_KEY = 'canvas'

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

    // Migration: filter out old-format images (have src but no recordId/storagePath)
    const validImages = raw.images.filter(
      (img) => img.recordId && img.storagePath && !img.pending,
    )

    return {
      ...raw,
      images: validImages,
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

    // Strip runtime-only fields and pending images before persisting
    const cleanImages = state.images
      .filter((img) => img.recordId && img.storagePath && !img.pending)
      .map(({ signedUrl: _, pending: __, ...rest }) => rest)

    tx.objectStore(STORE_NAME).put(
      { ...state, images: cleanImages },
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
  return createImageStorage(supabase).getUrl(storagePath, { cached: false })
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
