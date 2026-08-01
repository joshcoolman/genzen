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
}

/**
 * Resolve the S3 API endpoint. `R2_ENDPOINT` is the explicit form and is what
 * local dev sets (MinIO, `http://localhost:9010`). With it unset, an account id
 * derives Cloudflare R2's endpoint -- a convenience for one provider, not a
 * statement that genzen runs there. It does not: production sets `R2_ENDPOINT`
 * explicitly, pointing at a Railway bucket, so the account-id branch is unused.
 */
export function resolveStorageEndpoint(
  endpoint = process.env['R2_ENDPOINT'],
  accountId = process.env['R2_ACCOUNT_ID'],
): string | undefined {
  if (endpoint) return endpoint.replace(/\/$/, '')
  return accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined
}

/**
 * The bucket is private and server-only (#226). There is no public URL to
 * configure any more: the app serves its own images through `/img/[id]`, which
 * is the only thing that can check who is asking. Credentials never reach the
 * browser, and nothing here is client-callable.
 */
export function createImageStorage(): ImageStorage {
  return new S3ImageStorage(
    process.env['R2_BUCKET_NAME'] ?? 'genzen-images',
    resolveStorageEndpoint(),
    process.env['R2_ACCESS_KEY_ID'],
    process.env['R2_SECRET_ACCESS_KEY'],
  )
}
