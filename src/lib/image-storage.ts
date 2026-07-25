import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'

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

/**
 * MinIO (the local docker-compose stack) serves a single host, so the SDK's
 * default virtual-hosted addressing -- `bucket.localhost:9010` -- has nothing
 * to resolve to. Hosted providers (R2, S3) keep the default. This is the one
 * provider-specific concession in the storage layer.
 */
export function isLocalEndpoint(endpoint: string): boolean {
  try {
    const { hostname } = new URL(endpoint)
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === 'minio'
    )
  } catch {
    return false
  }
}

class S3ImageStorage implements ImageStorage {
  private client: S3Client | null

  constructor(
    private bucket: string,
    private publicUrl: string,
    endpoint?: string,
    accessKeyId?: string,
    secretAccessKey?: string,
  ) {
    // S3 client is only created server-side where credentials are available
    this.client =
      endpoint && accessKeyId && secretAccessKey
        ? new S3Client({
            region: 'auto',
            endpoint,
            credentials: { accessKeyId, secretAccessKey },
            forcePathStyle: isLocalEndpoint(endpoint),
          })
        : null
  }

  async upload(
    key: string,
    data: Uint8Array | Buffer | Blob,
    options: UploadOptions,
  ): Promise<void> {
    if (!this.client) {
      throw new Error('S3 client not available (missing server credentials)')
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
      throw new Error('S3 client not available (missing server credentials)')
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
      throw new Error('S3 client not available (missing server credentials)')
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

/**
 * Resolve the S3 API endpoint. `R2_ENDPOINT` is the explicit form and is what
 * local dev sets (MinIO, `http://localhost:9010`); when it is unset we derive
 * Cloudflare R2's endpoint from the account id exactly as before, so an
 * existing production config keeps working untouched.
 */
export function resolveStorageEndpoint(
  endpoint = process.env['R2_ENDPOINT'],
  accountId = process.env['R2_ACCOUNT_ID'],
): string | undefined {
  if (endpoint) return endpoint.replace(/\/$/, '')
  return accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined
}

export function createImageStorage(): ImageStorage {
  const publicUrl =
    (import.meta.env.VITE_R2_PUBLIC_URL as string | undefined) ??
    process.env['R2_PUBLIC_URL']

  if (!publicUrl) {
    throw new Error(
      'Image storage requires VITE_R2_PUBLIC_URL or R2_PUBLIC_URL',
    )
  }

  // S3 credentials are only available server-side (no VITE_ prefix)
  const accessKeyId = process.env['R2_ACCESS_KEY_ID']
  const secretAccessKey = process.env['R2_SECRET_ACCESS_KEY']
  const bucket = process.env['R2_BUCKET_NAME']

  return new S3ImageStorage(
    bucket ?? 'genzen-images',
    publicUrl.replace(/\/$/, ''),
    resolveStorageEndpoint(),
    accessKeyId,
    secretAccessKey,
  )
}
