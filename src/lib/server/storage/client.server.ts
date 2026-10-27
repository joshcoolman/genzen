import 'server-only'
import { copy, del, get, put } from '@vercel/blob'

const DEFAULT_CACHE_CONTROL = '31536000'
export interface UploadOptions {
  contentType: string
  cacheControl?: string
  upsert?: boolean
}

export interface ImageStorage {
  copy: (source: string, destination: string) => Promise<void>
  upload: (
    key: string,
    data: Uint8Array | Buffer | Blob,
    options: UploadOptions,
  ) => Promise<void>
  download: (key: string) => Promise<Blob>
  remove: (keys: Array<string>) => Promise<void>
}

/**
 * Vercel Blob, one private store (#777). The SDK reads its credentials from
 * the environment -- `BLOB_READ_WRITE_TOKEN`, which the connected store sets
 * on every environment and `vercel env pull` brings local -- so there is
 * nothing to construct and nothing to configure.
 *
 * The store is private and server-only (#226): nothing here hands out a URL.
 * The app serves its own images through `/img/[id]`, which is the only thing
 * that can check who is asking, and this module's `download` is what that
 * route and every server-side reader (FAL uploads, vision) call for bytes.
 *
 * Keys are the same `storage_path` values the S3 bucket held, written with no
 * random suffix so a row's path is the object's path. Overwrite is allowed
 * because the S3 client always overwrote: a poster regenerated for the same
 * clip lands on the same key.
 */
class BlobImageStorage implements ImageStorage {
  async upload(
    key: string,
    data: Uint8Array | Buffer | Blob,
    options: UploadOptions,
  ): Promise<void> {
    const body =
      data instanceof Blob
        ? Buffer.from(await data.arrayBuffer())
        : Buffer.from(data.buffer, data.byteOffset, data.byteLength)
    await put(key, body, {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: options.contentType,
      cacheControlMaxAge: Number(options.cacheControl ?? DEFAULT_CACHE_CONTROL),
    })
  }

  async download(key: string): Promise<Blob> {
    const result = await get(key, { access: 'private' })
    if (!result || result.statusCode !== 200) {
      throw new Error(`Stored file not found: ${key}`)
    }
    const bytes = await new Response(result.stream).arrayBuffer()
    return new Blob([bytes], { type: result.blob.contentType })
  }

  async copy(source: string, destination: string): Promise<void> {
    await copy(source, destination, {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
    })
  }

  async remove(keys: Array<string>): Promise<void> {
    if (keys.length === 0) return
    try {
      await del(keys)
    } catch {
      throw new Error('Some stored files could not be deleted. Please retry.')
    }
  }
}

export function createImageStorage(): ImageStorage {
  return new BlobImageStorage()
}
