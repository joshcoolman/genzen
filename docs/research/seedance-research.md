# ByteDance Seedance Video Models on fal.ai

Research date: March 2026

## Model Inventory

| Model                 | Endpoint                                               | Mode                 | Price (5s) | Max Res | Audio |
| --------------------- | ------------------------------------------------------ | -------------------- | ---------- | ------- | ----- |
| Seedance 1.0 Lite     | `fal-ai/bytedance/seedance/v1/lite/text-to-video`      | T2V                  | $0.18      | 720p    | No    |
| Seedance 1.0 Lite     | `fal-ai/bytedance/seedance/v1/lite/image-to-video`     | I2V + end frame      | $0.18      | 720p    | No    |
| Seedance 1.0 Lite     | `fal-ai/bytedance/seedance/v1/lite/reference-to-video` | Multi-ref (1-4 imgs) | $0.18      | 720p    | No    |
| Seedance 1.0 Pro      | `fal-ai/bytedance/seedance/v1/pro/text-to-video`       | T2V                  | $0.62      | 1080p   | No    |
| Seedance 1.0 Pro Fast | `fal-ai/bytedance/seedance/v1/pro/fast/text-to-video`  | T2V (fast)           | $0.245     | 1080p   | No    |
| Seedance 1.0 Pro      | `fal-ai/bytedance/seedance/v1/pro/image-to-video`      | I2V + end frame      | $0.62      | 1080p   | No    |
| Seedance 1.5 Pro      | `fal-ai/bytedance/seedance/v1.5/pro/text-to-video`     | T2V + audio          | $0.26      | 720p    | Yes   |
| Seedance 1.5 Pro      | `fal-ai/bytedance/seedance/v1.5/pro/image-to-video`    | I2V + audio + end    | $0.26      | 720p    | Yes   |

## First + Last Frame Support

Available on all I2V endpoints via `image_url` (start) + `end_image_url` (end):

- `v1/lite/image-to-video`
- `v1/pro/image-to-video`
- `v1.5/pro/image-to-video`

Competitive with `fal-ai/wan-flf2v` for first-last-frame workflows.

## Key Parameters (I2V)

```typescript
{
  prompt: string,           // required
  image_url: string,        // required - start frame
  end_image_url?: string,   // optional - end frame
  aspect_ratio: "21:9" | "16:9" | "4:3" | "1:1" | "3:4" | "9:16" | "auto",
  resolution: "480p" | "720p" | "1080p",
  duration: "2" | "3" | ... | "12",  // seconds
  camera_fixed?: boolean,
  generate_audio?: boolean, // v1.5 only
  seed?: number,
}
```

Output: `{ video: { url, content_type, file_name, file_size }, seed }`

## Seedance 2.0 (Not Yet Available via API)

Announced Feb 12, 2026. Delayed from API launch due to Hollywood copyright disputes.

Key features:

- Dual-Branch Diffusion Transformer (simultaneous audio + video)
- Native dialogue with lip-sync (8+ languages)
- Physics simulation (collisions, fabric, fluids)
- Director-level camera control (dolly, rack focus, tracking)
- Up to 12 simultaneous inputs (9 images + 3 videos + 3 audio)
- Max 2K resolution, 15-second duration

## Comparison Quick Reference

| Model              | Price/5s   | Audio | First/Last Frame | Max Res |
| ------------------ | ---------- | ----- | ---------------- | ------- |
| Seedance 1.0 Lite  | $0.18      | No    | Yes              | 720p    |
| Seedance 1.5 Pro   | $0.26      | Yes   | Yes              | 720p    |
| Seedance 1.0 Pro   | $0.62      | No    | Yes              | 1080p   |
| Wan FLF2V          | $0.20-0.40 | No    | Yes              | 720p    |
| Kling 1.6 Standard | $0.225     | No    | No               | 1080p   |
| Veo 2              | $1.25      | No    | Yes              | 1080p   |

## Unique: Reference-to-Video

`v1/lite/reference-to-video` accepts 1-4 images as style/character references (not start/end frames). Useful for character consistency across shots. Only available on Lite tier.
