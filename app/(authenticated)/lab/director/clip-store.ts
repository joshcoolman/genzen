import { z } from 'zod'
import { settingsSchema } from './clips'
import type { Cut } from './clips'

const blobSchema = z.instanceof(Blob)
const cutSchema = z.object({
  version: z.literal(1),
  clips: z.array(
    z.object({
      id: z.string(),
      prompt: z.string(),
      blob: blobSchema,
      endFrame: blobSchema,
      duration: z.number().positive(),
      model: z.string(),
      elapsedMs: z.number().optional(),
      imported: z.boolean().optional(),
    }),
  ),
  settings: settingsSchema,
  initialImage: blobSchema.nullable(),
  pending: z
    .object({
      id: z.string(),
      prompt: z.string(),
      context: z.array(z.string()),
      settings: settingsSchema,
      redo: z.boolean(),
      startedAt: z.number(),
      token: z.string().optional(),
    })
    .nullable(),
})

async function database(owner: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(`genzen-director-clips-v1-${owner}`, 1)
    request.onupgradeneeded = () => request.result.createObjectStore('cut')
    request.onerror = () =>
      reject(new Error('Local clip storage is unavailable.'))
    request.onblocked = () =>
      reject(new Error('Close other Director tabs and reload.'))
    request.onsuccess = () => resolve(request.result)
  })
}
export async function readCut(owner: string): Promise<Cut | null> {
  const db = await database(owner)
  try {
    const raw = await new Promise<unknown>((resolve, reject) => {
      const request = db.transaction('cut').objectStore('cut').get('current')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () =>
        reject(new Error('Could not restore the saved cut.'))
    })
    return raw === undefined ? null : cutSchema.parse(raw)
  } finally {
    db.close()
  }
}
/** Footage, ending frames and the receipt commit atomically. */
export async function saveCut(owner: string, cut: Cut): Promise<void> {
  const db = await database(owner)
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('cut', 'readwrite')
      tx.objectStore('cut').put(cut, 'current')
      tx.oncomplete = () => resolve()
      tx.onabort = tx.onerror = () =>
        reject(
          new Error(
            'Could not save locally. Your saved cut is unchanged; free browser storage and retry.',
          ),
        )
    })
  } finally {
    db.close()
  }
}
export function draftKey(owner: string) {
  return `genzen-director-clip-draft-v1-${owner}`
}
