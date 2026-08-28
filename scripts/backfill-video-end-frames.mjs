// Give every clip already in the library the end frame #512 only writes for new
// ones.
//
// #512 taught ingest to extract the frame a clip *ends* on, so Sequence can put
// one clip's ending beside the next one's beginning. It did not walk what was
// already there, and every clip in the library predates it -- so without this
// pass the feature that motivated the column shows nothing for every clip that
// exists. `/img/[id]?v=end` deliberately does not fall back, which is why a
// missing end frame is a blank half-tile rather than a wrong frame.
//
// One-off, run by hand, then deleted. Not heal-on-read: that is a code path
// living forever to fix something that stops existing after one run.
//
// Trashed clips are included, on #511's reasoning -- Trash renders clip tiles
// too, and a soft delete keeps the object, so there is something to read.
//
// **The output must match `src/lib/server/video-poster.server.ts` exactly** --
// same 400px WebP at quality 80, same `-sseof -1 -update 1` decode, same
// `{userId}/thumbs/{name}-end.webp` key. A backfilled clip that differs from a
// freshly generated one is a bug that shows up as a row of subtly mismatched
// tiles. The constants are duplicated here rather than imported because `#/` is
// a bundler alias that plain Node does not resolve, and every script in this
// folder is self-contained for the same reason.
//
// Usage: node scripts/backfill-video-end-frames.mjs [--dry-run]
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
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
const END_SEEK_SECONDS = 1

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

// The last frame ffmpeg can decode, as WebP bytes, or null. `-update 1`
// overwrites one file per frame from the seek point on, so what survives is the
// frame the clip ends on -- piping would hand back every frame concatenated and
// sharp would read the first.
async function endFrameFor(bytes) {
  const dir = await mkdtemp(join(tmpdir(), 'genzen-endframe-'))
  try {
    const file = join(dir, `${randomUUID()}.mp4`)
    await writeFile(file, bytes)
    const out = join(dir, `${randomUUID()}.png`)

    await execFileAsync(
      ffmpegPath,
      [
        '-loglevel',
        'error',
        '-sseof',
        `-${END_SEEK_SECONDS}`,
        '-i',
        file,
        '-update',
        '1',
        '-y',
        out,
      ],
      { timeout: TIMEOUT_MS },
    )

    const frame = await readFile(out)
    if (!frame.length) return null

    return await sharp(frame)
      .resize(THUMBNAIL_WIDTH, null, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: THUMBNAIL_QUALITY })
      .toBuffer()
  } catch {
    return null
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

const rows = await sql`
  select id, user_id, storage_path, deleted_at
  from user_images
  where source = 'ai_video'
    and end_frame_path is null
    and storage_path is not null
  order by created_at
`

console.log(
  `${rows.length} clip${rows.length === 1 ? '' : 's'} without an end frame` +
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

    const webp = await endFrameFor(bytes)
    if (!webp) {
      console.warn(`  ${label}  no final frame decoded, skipped`)
      failed++
      continue
    }

    const filename = row.storage_path.split('/').pop()
    const endFramePath = `${row.user_id}/thumbs/${filename.replace(/\.[^.]+$/, '')}-end.webp`

    if (dryRun) {
      console.log(`  ${label}  would write ${endFramePath}`)
      done++
      continue
    }

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: endFramePath,
        Body: webp,
        ContentType: 'image/webp',
        CacheControl: 'max-age=31536000',
      }),
    )

    // The object goes up before the row points at it, same order as ingest --
    // a row naming a frame that is not there 404s the half-tile, a stored
    // object nothing names is merely unreferenced.
    await sql`
      update user_images
      set end_frame_path = ${endFramePath}
      where id = ${row.id} and user_id = ${row.user_id}
    `
    console.log(`  ${label}  ${endFramePath.split('/').pop()}`)
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
  where source = 'ai_video' and end_frame_path is null and storage_path is not null
`
console.log(
  `\n${done} done, ${failed} failed, ${remaining[0].n} still without an end frame`,
)

await sql.end()
