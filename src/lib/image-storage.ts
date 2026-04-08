import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import type { SupabaseClient } from '@supabase/supabase-js'

const DEFAULT_CACHE_CONTROL = '31536000'
export interface UploadOptions {
  contentType: string
  cacheControl?: string
  upsert?: boolean
}

export interface ImageStorage {
  upload: (
    key: string,
    data: Uint8Array | Buffer | Blob,
    options: UploadOptions,
  ) => Promise<void>
  download: (key: string) => Promise<Blob>
  remove: (keys: Array<string>) => Promise<void>
  getUrl: (key: string) => Promise<string | null>
  invalidateUrl: (key: string) => void
}

class R2ImageStorage implements ImageStorage {
  private client: S3Client | null

  constructor(
    private bucket: string,
    private publicUrl: string,
    accountId?: string,
    accessKeyId?: string,
    secretAccessKey?: string,
  ) {
    // S3 client is only created server-side where credentials are available
    this.client =
      accountId && accessKeyId && secretAccessKey
        ? new S3Client({
            region: 'auto',
            endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
            credentials: { accessKeyId, secretAccessKey },
          })
        : null
  }

  async upload(
    key: string,
    data: Uint8Array | Buffer | Blob,
    options: UploadOptions,
  ): Promise<void> {
    if (!this.client) {
      throw new Error('R2 S3 client not available (missing server credentials)')
    }
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
    if (!this.client) {
      throw new Error('R2 S3 client not available (missing server credentials)')
    }
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    )
    const bytes = await response.Body!.transformToByteArray()
    return new Blob([Buffer.from(bytes)], { type: response.ContentType })
  }

  async remove(keys: Array<string>): Promise<void> {
    if (keys.length === 0) return
    if (!this.client) {
      throw new Error('R2 S3 client not available (missing server credentials)')
    }
    await this.client.send(
      new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: { Objects: keys.map((Key) => ({ Key })) },
      }),
    )
  }

  getUrl(key: string): Promise<string | null> {
    return Promise.resolve(`${this.publicUrl}/${key}`)
  }

  invalidateUrl(_key: string): void {
    // No-op for R2 public URLs
  }
}

/** Synchronous URL builder for R2 public URLs -- no async needed */
export function getR2PublicUrl(storagePath: string): string {
  const publicUrl =
    (import.meta.env.VITE_R2_PUBLIC_URL as string | undefined) ??
    process.env['R2_PUBLIC_URL']
  if (!publicUrl) throw new Error('R2_PUBLIC_URL not configured')
  return `${publicUrl.replace(/\/$/, '')}/${storagePath}`
}

export function createImageStorage(_supabase?: SupabaseClient): ImageStorage {
  const publicUrl =
    (import.meta.env.VITE_R2_PUBLIC_URL as string | undefined) ??
    process.env['R2_PUBLIC_URL']

  if (!publicUrl) {
    throw new Error('R2 storage requires VITE_R2_PUBLIC_URL or R2_PUBLIC_URL')
  }

  // S3 credentials are only available server-side (no VITE_ prefix)
  const accountId = process.env['R2_ACCOUNT_ID']
  const accessKeyId = process.env['R2_ACCESS_KEY_ID']
  const secretAccessKey = process.env['R2_SECRET_ACCESS_KEY']
  const bucket = process.env['R2_BUCKET_NAME']

  return new R2ImageStorage(
    bucket ?? 'genzen-images',
    publicUrl.replace(/\/$/, ''),
    accountId,
    accessKeyId,
    secretAccessKey,
  )
}
