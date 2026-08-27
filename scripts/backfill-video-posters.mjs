// Give every clip already in the library the poster frame #499 only writes for
// new ones.
//
// #499 taught ingest to extract frame one; it did not walk what was already
// there. Until it has, half the clips have a NULL `thumbnail_path` -- and that
// blocks #500, because `/img/[id]?v=thumb` serves the thumbnail only
// `&& !!row.thumbnail_path` and otherwise falls back to `storage_path`. For a
// clip that is the mp4, so a poster-less clip inside an `<img>` is not a
// graceful degradation: it is the broken-file icon, having downloaded 20MB of
// video to get there.
//
// One-off, run by hand, then deleted. Not heal-on-read: that is a code path
// living forever to fix something that stops existing after one run.
//
// Trashed clips are included. Trash renders clip tiles too, so skipping them
// just moves the broken tiles somewhere less visible. A soft delete keeps the
// object, so there is something to read.
//
// **The output must match `src/lib/server/video-poster.server.ts` exactly** --
// same 400px WebP at quality 80, same `{userId}/thumbs/{name}.webp` key. A
// backfilled clip that differs from a freshly generated one is a bug that
// shows up as a grid of subtly mismatched tiles. The constants are duplicated
// here rather than imported because `#/` is a bundler alias that plain Node
// does not resolve, and every script in this folder is self-contained for the
// same reason. If that file's numbers change, this one is already deleted.
//
// Usage: node scripts/backfill-video-posters.mjs [--dry-run]
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import sharp from 'sharp'
import ffmpegPath from 'ffmpeg-static'
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'

const execFileAsync = promisify(execFile)

const THUMBNAIL_WIDTH = 400
const THUMBNAIL_QUALITY = 80
const TIMEOUT_MS = 30_000

const ENV_LOCAL_PATH = new URL('../.env.local', import.meta.url)
if (existsSync(ENV_LOCAL_PATH)) process.loadEnvFile(ENV_LOCAL_PATH)

const dryRun = process.argv.includes('--dry-run')

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('DATABASE_URL is not set. Run `pnpm local:up`.')
  process.exit(1)
}

const endpoint = (process.env.R2_ENDPOINT ?? '').replace(/\/$/, '')
const bucket = process.env.R2_BUCKET_NAME ?? 'genzen-images'
const accessKeyId = process.env.R2_ACCESS_KEY_ID
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
if (!endpoint || !accessKeyId || !secretAccessKey) {
  console.error(
    'R2_ENDPOINT / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY not set.',
  )
  process.exit(1)
}

// Same concession as `image-storage.ts`: MinIO serves one host, so
// `bucket.localhost` has nothing to resolve to.
const { hostname } = new URL(endpoint)
const forcePathStyle =
  hostname === 'localhost' || hostname === '127.0.0.1' || hostname === 'minio'

const s3 = new S3Client({
  region: 'auto',
  endpoint,
  credentials: { accessKeyId, secretAccessKey },
  forcePathStyle,
})

const sql = postgres(databaseUrl, { onnotice: () => {} })

async function posterFor(bytes) {
  const dir = await mkdtemp(join(tmpdir(), 'genzen-backfill-'))
  try {
    const file = join(dir, `${randomUUID()}.mp4`)
    await writeFile(file, bytes)
    const { stdout: frame } = await execFileAsync(
      ffmpegPath,
      [
        '-loglevel',
        'error',
        '-i',
        file,
        '-frames:v',
        '1',
        '-c:v',
        'png',
        '-f',
        'image2pipe',
        '-',
      ],
      { timeout: TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024, encoding: 'buffer' },
    )
    if (!frame.length) return null

    const image = sharp(frame)
    const { width, height } = await image.metadata()
    const webp = await image
      .resize(THUMBNAIL_WIDTH, null, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: THUMBNAIL_QUALITY })
      .toBuffer()

    return { webp, width: width ?? null, height: height ?? null }
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

const rows = await sql`
  select id, user_id, storage_path, deleted_at
  from user_images
  where source = 'ai_video'
    and thumbnail_path is null
    and storage_path is not null
  order by created_at
`

console.log(
  `${rows.length} clip${rows.length === 1 ? '' : 's'} without a poster` +
    (dryRun ? ' (dry run, nothing will be written)' : ''),
)

let done = 0
let failed = 0

for (const row of rows) {
  const label = `${row.id.slice(0, 8)}${row.deleted_at ? ' (trashed)' : ''}`
  try {
    const object = await s3.send(
      new GetObjectCommand({ Bucket: bucket, Key: row.storage_path }),
    )
    const bytes = await object.Body.transformToByteArray()

    const poster = await posterFor(bytes)
    if (!poster) {
      console.warn(`  ${label}  no frame decoded, skipped`)
      failed++
      continue
    }

    const filename = row.storage_path.split('/').pop()
    const thumbnailPath = `${row.user_id}/thumbs/${filename.replace(/\.[^.]+$/, '.webp')}`

    if (dryRun) {
      console.log(
        `  ${label}  would write ${thumbnailPath} (${poster.width}x${poster.height})`,
      )
      done++
      continue
    }

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: thumbnailPath,
        Body: poster.webp,
        ContentType: 'image/webp',
        CacheControl: 'max-age=31536000',
      }),
    )

    // The object goes up before the row points at it, same order as ingest --
    // a row naming a thumbnail that is not there renders as broken, a stored
    // object nothing names is merely unreferenced.
    await sql`
      update user_images
      set thumbnail_path = ${thumbnailPath},
          width = ${poster.width},
          height = ${poster.height}
      where id = ${row.id} and user_id = ${row.user_id}
    `
    console.log(`  ${label}  ${poster.width}x${poster.height}`)
    done++
  } catch (err) {
    console.warn(
      `  ${label}  failed: ${err instanceof Error ? err.message : err}`,
    )
    failed++
  }
}

const remaining = await sql`
  select count(*)::int as n from user_images
  where source = 'ai_video' and thumbnail_path is null and storage_path is not null
`
console.log(
  `\n${done} done, ${failed} failed, ${remaining[0].n} still without a poster`,
)
if (!dryRun && remaining[0].n === 0) {
  console.log('Every clip has a poster. #500 can switch the tiles over.')
}

await sql.end()
