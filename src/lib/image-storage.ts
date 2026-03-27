import type { SupabaseClient } from '@supabase/supabase-js'

const BUCKET = 'user-images'
const DEFAULT_CACHE_CONTROL = '31536000'
const DEFAULT_SIGNED_URL_TTL = 86400
export interface UploadOptions {
  contentType: string
  cacheControl?: string
  upsert?: boolean
}

export interface GetUrlOptions {
  ttl?: number
  transform?: {
    width?: number
    resize?: 'contain' | 'cover' | 'fill'
    quality?: number
  }
  cached?: boolean
  cacheTtl?: number
}

export interface ImageStorage {
  upload: (
    key: string,
    data: Uint8Array | Buffer | Blob,
    options: UploadOptions,
  ) => Promise<void>
  download: (key: string) => Promise<Blob>
  remove: (keys: Array<string>) => Promise<void>
  getUrl: (key: string, options?: GetUrlOptions) => Promise<string | null>
  invalidateUrl: (key: string) => void
}

interface CacheEntry {
  url: string
  expiresAt: number
}

const urlCache = new Map<string, CacheEntry>()

class SupabaseImageStorage implements ImageStorage {
  constructor(private supabase: SupabaseClient) {}

  async upload(
    key: string,
    data: Uint8Array | Buffer | Blob,
    options: UploadOptions,
  ): Promise<void> {
    const { error } = await this.supabase.storage
      .from(BUCKET)
      .upload(key, data, {
        contentType: options.contentType,
        cacheControl: options.cacheControl ?? DEFAULT_CACHE_CONTROL,
        upsert: options.upsert ?? false,
      })
    if (error) throw new Error(`Upload failed: ${error.message}`)
  }

  async download(key: string): Promise<Blob> {
    const { data, error } = await this.supabase.storage
      .from(BUCKET)
      .download(key)
    if (error) throw new Error(`Download failed: ${error.message}`)
    return data
  }

  async remove(keys: Array<string>): Promise<void> {
    const { error } = await this.supabase.storage.from(BUCKET).remove(keys)
    if (error) throw new Error(`Remove failed: ${error.message}`)
  }

  async getUrl(key: string, options?: GetUrlOptions): Promise<string | null> {
    const shouldCache = options?.cached !== false
    const cacheTtlMs = (options?.cacheTtl ?? 82800) * 1000

    if (shouldCache) {
      const cached = urlCache.get(key)
      if (cached && cached.expiresAt > Date.now()) {
        return cached.url
      }
    }

    const ttl = options?.ttl ?? DEFAULT_SIGNED_URL_TTL
    const signedUrlOptions = options?.transform
      ? { transform: options.transform }
      : undefined

    const { data } = await this.supabase.storage
      .from(BUCKET)
      .createSignedUrl(key, ttl, signedUrlOptions)

    if (!data?.signedUrl) return null

    if (shouldCache) {
      urlCache.set(key, {
        url: data.signedUrl,
        expiresAt: Date.now() + cacheTtlMs,
      })
    }

    return data.signedUrl
  }

  invalidateUrl(key: string): void {
    urlCache.delete(key)
  }
}

export function createImageStorage(supabase: SupabaseClient): ImageStorage {
  return new SupabaseImageStorage(supabase)
}
