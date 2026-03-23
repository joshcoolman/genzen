import type { PersistedState } from '../types'

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
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(storageKey)
      req.onsuccess = () => resolve(req.result ?? null)
      req.onerror = () => resolve(null)
    })
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
    tx.objectStore(STORE_NAME).put(state, storageKey)
  } catch {
    /* silent fail */
  }
}

export function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
