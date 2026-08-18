import 'server-only'
import { first, sql } from './db.server'
import { uploadBufferToFal } from './fal-image-upload.server'
import { createImageStorage } from '#/lib/image-storage'

/** Every image FAL is given is uploaded as **bytes**, never handed over as a URL
 *  for FAL to fetch. That was already true because a `localhost:9010` object is
 *  unreachable from FAL -- it answers "Could not generate images with the given
 *  prompts and images", which reads as a model complaint rather than a plumbing
 *  failure. Generate learned this; retry had not (#214).
 *
 *  Since #226 it is also the only thing that *can* work: images are served by
 *  an authenticated app route, so there is no URL a third party could fetch.
 *  The bytes come straight out of the bucket, which the server has credentials
 *  for -- nothing here goes over HTTP to our own app. */

/**
 * FAL URLs for library images, keyed by owner and row (#313).
 *
 * A submit against three models is three concurrent server actions, and each
 * one used to pull the same reference bytes out of the bucket and upload them
 * to FAL again -- the same megabytes moved three times, which is most of the
 * wall clock on a multi-model run.
 *
 * The **promise** is cached rather than the URL, so a caller arriving while an
 * upload is in flight joins it instead of starting a second one. That is the
 * whole mechanism: without it, three simultaneous calls all miss an empty
 * cache and nothing is saved.
 *
 * A row's bytes never change -- a different picture is a different row -- so
 * the TTL is not about staleness. It bounds memory, and it avoids handing FAL
 * a URL from an upload old enough that they may no longer serve it.
 *
 * Keyed by user as well as row because everything here is user-scoped; a cache
 * is not a reason for one person's upload to answer another's request.
 */
const FAL_URL_TTL_MS = 5 * 60 * 1000
const falUrlCache = new Map<string, { url: Promise<string>; at: number }>()

function cachedFalUpload(
  userId: string,
  imageId: string,
  upload: () => Promise<string>,
): Promise<string> {
  const now = Date.now()
  for (const [k, v] of falUrlCache) {
    if (now - v.at >= FAL_URL_TTL_MS) falUrlCache.delete(k)
  }

  const key = `${userId}:${imageId}`
  const hit = falUrlCache.get(key)
  if (hit) return hit.url

  const url = upload()
  falUrlCache.set(key, { url, at: now })
  // A failure is never remembered. Caching a rejection would make one transient
  // bucket error the answer for the next five minutes, including to the retry
  // the user reaches for immediately afterwards.
  void url.catch(() => {
    if (falUrlCache.get(key)?.url === url) falUrlCache.delete(key)
  })
  return url
}

async function downloadAndUploadToFal(storagePath: string): Promise<string> {
  const blob = await createImageStorage().download(storagePath)
  return uploadBufferToFal(await blob.arrayBuffer())
}

/** Read a library object's bytes, scoped to its owner. */
export async function readLibraryImageBytes(
  imageId: string,
  userId: string,
): Promise<ArrayBuffer | null> {
  const row = first(
    await sql<Array<{ storage_path: string | null }>>`
      select storage_path from user_images
      where id = ${imageId} and user_id = ${userId} and deleted_at is null
    `,
  )
  if (!row?.storage_path) return null
  try {
    const blob = await createImageStorage().download(row.storage_path)
    return await blob.arrayBuffer()
  } catch {
    return null
  }
}

/** Upload a set of library images to FAL, preserving the caller's order.
 *
 *  Order matters: models read the list positionally, and the prompt labels them
 *  "[Image 1, Image 2, ...]". A `Promise.all` over the ids keeps that; resolving
 *  by whatever the database returned would not, because `in (...)` has no
 *  ordering guarantee.
 *
 *  **Throws if any image cannot be read** (#364). It used to drop them and
 *  carry on, reasoning that one missing reference should not sink a generation
 *  that has others -- but the generation then ran, FAL billed in full, and the
 *  card said completed. You had built a request with three references, two were
 *  sent, and nothing anywhere said so. A degraded result you paid for is worse
 *  than a failure you can retry, and this is the cheap moment: no money has
 *  been spent yet.
 *
 *  The source-image path always worked this way -- a generation cannot be
 *  faithful without its source -- and references took the opposite path for no
 *  stated reason. */
export class ReferenceImageUnreadableError extends Error {
  constructor(missing: number, total: number) {
    super(
      `${missing} of ${total} reference images could not be read. Nothing was generated.`,
    )
    this.name = 'ReferenceImageUnreadableError'
  }
}

export async function uploadLibraryImagesToFal(
  imageIds: Array<string>,
  userId: string,
): Promise<Array<string>> {
  if (imageIds.length === 0) return []

  const rows = await sql<Array<{ id: string; storage_path: string | null }>>`
    select id, storage_path from user_images
    where id in ${sql(imageIds)} and user_id = ${userId}
  `
  const pathById = new Map(rows.map((r) => [r.id, r.storage_path]))

  const uploaded = await Promise.all(
    imageIds.map(async (id) => {
      const storagePath = pathById.get(id)
      if (!storagePath) return null
      try {
        return await cachedFalUpload(userId, id, () =>
          downloadAndUploadToFal(storagePath),
        )
      } catch {
        return null
      }
    }),
  )
  const usable = uploaded.filter((u): u is string => u !== null)
  if (usable.length !== imageIds.length) {
    throw new ReferenceImageUnreadableError(
      imageIds.length - usable.length,
      imageIds.length,
    )
  }
  return usable
}

/** The same, for the one image a generation calls its source. Returns null when
 *  the row is gone or unreadable, which the caller reports as a missing source
 *  -- the reference path drops one and carries on, a missing source cannot. */
export async function uploadLibraryImageToFal(
  imageId: string,
  userId: string,
): Promise<string | null> {
  const row = first(
    await sql<Array<{ storage_path: string | null }>>`
      select storage_path from user_images
      where id = ${imageId} and user_id = ${userId} and deleted_at is null
    `,
  )
  const storagePath = row?.storage_path
  if (!storagePath) return null
  try {
    return await cachedFalUpload(userId, imageId, () =>
      downloadAndUploadToFal(storagePath),
    )
  } catch {
    return null
  }
}
