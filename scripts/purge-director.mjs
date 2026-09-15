// Throw away everything the old Director made: bytes first, then rows (#662).
//
// Director owned its own media -- its own table, its own bucket objects, its
// own serving routes -- and its saved exports were republished into the library
// as independent rows carrying `origin = 'director'`. #662 replaces all of it
// with runs of ordinary library clips, and the decision there was to delete the
// old content rather than migrate it: it was experimentation, and an importer
// is most of what would have made this a project instead of a deletion.
//
// **What it must not touch: anything made in Sequence.** Those clips were
// written by the ordinary `generateVideo` path and carry `origin = 'images'`,
// so `origin` is the whole line between the two. The script prints what it is
// about to delete and stops unless `--yes` is given.
//
// **Bytes before rows**, which is the order Director's own cleanup used: a
// failed object delete leaves the rows behind, so running it again finds the
// same work rather than orphaned objects nobody can name any more.
//
// One-off. Run it, then `pnpm db:migrate` drops the tables -- after which this
// script has nothing left to read and can go.
//
// Usage: node scripts/purge-director.mjs [--yes]
import { existsSync } from 'node:fs'
import postgres from 'postgres'
import { DeleteObjectsCommand, S3Client } from '@aws-sdk/client-s3'

const ENV_LOCAL_PATH = new URL('../.env.local', import.meta.url)
if (existsSync(ENV_LOCAL_PATH)) process.loadEnvFile(ENV_LOCAL_PATH)

const confirmed = process.argv.includes('--yes')

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

const tableExists = async (name) =>
  (await sql`select to_regclass(${`public.${name}`}) as reg`)[0].reg !== null

async function removeObjects(keys) {
  for (let offset = 0; offset < keys.length; offset += 500) {
    const batch = keys.slice(offset, offset + 500)
    const result = await s3.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
      }),
    )
    // A key that was already gone is not an error; anything else is, and the
    // rows stay put so a rerun does the same work.
    const errors = (result.Errors ?? []).filter(
      (error) => error.Code !== 'NoSuchKey',
    )
    if (errors.length) {
      throw new Error(
        `Bucket delete failed: ${errors.map((e) => `${e.Key} (${e.Code})`).join(', ')}`,
      )
    }
  }
}

const media = (await tableExists('director_media'))
  ? await sql`select storage_path from director_media`
  : []
const published =
  await sql`select id, storage_path, thumbnail_path, end_frame_path
    from user_images where origin = 'director'`

const keys = [
  ...media.map((row) => row.storage_path),
  ...published.flatMap((row) =>
    [row.storage_path, row.thumbnail_path, row.end_frame_path].filter(Boolean),
  ),
]

console.log(`director_media objects:   ${media.length}`)
console.log(`published export rows:    ${published.length}`)
console.log(`bucket objects to delete: ${keys.length}`)

if (!confirmed) {
  console.log('\nNothing deleted. Re-run with --yes to go ahead.')
  await sql.end()
  process.exit(0)
}

await removeObjects(keys)
console.log('bucket objects deleted')

if (published.length) {
  await sql`delete from user_images where id in ${sql(published.map((row) => row.id))}`
  console.log(`published export rows deleted: ${published.length}`)
}
if (await tableExists('director_sessions')) {
  // One delete: media, requests, exports, final cuts and export publications
  // all hang off the session row by `on delete cascade`, which is how
  // Director's own `deleteSession` did it. The migration then drops the empty
  // tables, and `director_sessions` itself stays -- it is what a run is stored
  // in now.
  const gone = await sql`delete from director_sessions returning id`
  console.log(`director sessions deleted: ${gone.length}`)
}

console.log('\nDone. Run `pnpm db:migrate` to drop the tables.')
await sql.end()
