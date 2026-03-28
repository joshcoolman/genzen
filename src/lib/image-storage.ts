import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
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

class R2ImageStorage implements ImageStorage {
  private client: S3Client

  constructor(
    private bucket: string,
    private publicUrl: string,
    accountId: string,
    accessKeyId: string,
    secretAccessKey: string,
  ) {
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    })
  }

  async upload(
    key: string,
    data: Uint8Array | Buffer | Blob,
    options: UploadOptions,
  ): Promise<void> {
    const body =
      data instanceof Blob ? Buffer.from(await data.arrayBuffer()) : data
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: options.contentType,
        CacheControl: `max-age=${options.cacheControl ?? DEFAULT_CACHE_CONTROL}`,
      }),
    )
  }

  async download(key: string): Promise<Blob> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    )
    const bytes = await response.Body!.transformToByteArray()
    return new Blob([Buffer.from(bytes)], { type: response.ContentType })
  }

  async remove(keys: Array<string>): Promise<void> {
    if (keys.length === 0) return
    await this.client.send(
      new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: { Objects: keys.map((Key) => ({ Key })) },
      }),
    )
  }

  async getUrl(key: string): Promise<string | null> {
    return `${this.publicUrl}/${key}`
  }

  invalidateUrl(_key: string): void {
    // R2 public URLs don't expire — no-op
  }
}

export function createImageStorage(supabase: SupabaseClient): ImageStorage {
  const provider = process.env['STORAGE_PROVIDER'] ?? 'supabase'

  if (provider === 'r2') {
    const accountId = process.env['R2_ACCOUNT_ID']
    const accessKeyId = process.env['R2_ACCESS_KEY_ID']
    const secretAccessKey = process.env['R2_SECRET_ACCESS_KEY']
    const bucket = process.env['R2_BUCKET_NAME']
    const publicUrl = process.env['R2_PUBLIC_URL']

    if (
      !accountId ||
      !accessKeyId ||
      !secretAccessKey ||
      !bucket ||
      !publicUrl
    ) {
      throw new Error(
        'R2 storage requires R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, and R2_PUBLIC_URL',
      )
    }

    return new R2ImageStorage(
      bucket,
      publicUrl.replace(/\/$/, ''),
      accountId,
      accessKeyId,
      secretAccessKey,
    )
  }

  return new SupabaseImageStorage(supabase)
}
