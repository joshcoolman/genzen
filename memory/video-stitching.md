# Video Stitching / Concatenation

## TL;DR

**Two-tier approach:**

1. **In-app playback only** -> HTML5 sequential playback, zero server work
2. **Need a real merged file** -> `fal-ai/ffmpeg-api/merge-videos` -- already in the stack, accepts Supabase signed URLs directly, currently free

## Option 1: HTML5 Sequential Playback (no stitching)

Zero complexity. Use the `ended` event to swap `src` and play the next clip. No server involvement. Not a downloadable file -- just sequential in-browser playback.

```tsx
export function VideoSequencePlayer({ urls }: { urls: string[] }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [currentIndex, setCurrentIndex] = useState(0)

  const handleEnded = () => {
    const next = currentIndex + 1
    if (next < urls.length) setCurrentIndex(next)
  }

  return (
    <video
      ref={videoRef}
      src={urls[currentIndex]}
      autoPlay
      controls
      onEnded={handleEnded}
      onLoadedData={() => videoRef.current?.play()}
    />
  )
}
```

## Option 2: FAL.ai merge-videos (best for real files)

FAL has a native `fal-ai/ffmpeg-api/merge-videos` endpoint. Accepts a list of video URLs, returns a merged video URL. Currently priced at $0/compute second. Takes Supabase signed URLs directly as input.

```typescript
// src/features/ai-video/server/merge-videos.server.ts
import { createServerFn } from '@tanstack/react-start'
import { fal } from '@fal-ai/client'

export const mergeVideos = createServerFn({ method: 'POST' })
  .inputValidator((data: { videoUrls: string[] }) => data)
  .handler(async ({ data }) => {
    const result = await fal.subscribe('fal-ai/ffmpeg-api/merge-videos', {
      input: { video_urls: data.videoUrls },
    })
    return { mergedUrl: result.data.video.url }
  })
```

## Option 3: Raw FFmpeg on Fly.io (self-hosted fallback)

Add to Dockerfile: `RUN apk add --no-cache ffmpeg` (~30MB on Alpine). Use concat demuxer with `-c copy` -- no re-encoding, near-instant for same-codec clips. All FAL.ai clips from the same model share codec/resolution/framerate so `-c copy` always works.

```typescript
// src/lib/server/ffmpeg-concat.server.ts
import { spawn } from 'child_process'
import { writeFile, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { randomUUID } from 'crypto'

export async function concatVideos(inputUrls: string[]): Promise<string> {
  const id = randomUUID()
  const listPath = join(tmpdir(), `concat-${id}.txt`)
  const outPath = join(tmpdir(), `merged-${id}.mp4`)

  await writeFile(listPath, inputUrls.map((u) => `file '${u}'`).join('\n'))

  await new Promise<void>((resolve, reject) => {
    const proc = spawn('ffmpeg', [
      '-f',
      'concat',
      '-safe',
      '0',
      '-protocol_whitelist',
      'file,http,https,tcp,tls,crypto',
      '-i',
      listPath,
      '-c',
      'copy',
      '-y',
      outPath,
    ])
    let stderr = ''
    proc.stderr.on('data', (c) => (stderr += c))
    proc.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(stderr)),
    )
    proc.on('error', reject)
  })

  await unlink(listPath).catch(() => {})
  return outPath
}
```

## What to Avoid

- **fluent-ffmpeg** -- archived by its author May 2025, unmaintained. Skip.
- **ffmpeg.wasm** -- WebAssembly, browser-only, no GPU, memory ceiling, needs COOP/COEP headers. Wrong tool for server use.
- **Mux / Cloudflare Stream** -- neither offers a simple "join clips" REST endpoint. Cloudflare Stream is delivery-only. Mux requires complex Compositions product. Overkill.

## Summary

| Option           | Complexity | Cost         | Use when                                    |
| ---------------- | ---------- | ------------ | ------------------------------------------- |
| HTML5 sequential | Trivial    | Free         | In-app viewing, no download needed          |
| FAL merge-videos | Very low   | Free (now)   | Need a real merged file, stay in FAL stack  |
| FFmpeg spawn     | Low        | Free (infra) | Self-hosted fallback if FAL pricing changes |
