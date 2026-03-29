# Kling 3.0

Announced February 2026. Core shift: single inference pass generates up to 6 discrete shots with cuts, maintaining character/lighting/atmosphere consistency across all of them. Not clip stitching -- the model outputs the full sequence holistically.

## Two Model Variants

- **Kling V3** -- prompt-first, text-to-video + image-to-video. Max 1080p.
- **Kling O3** -- reference-first, optimized for character refs / video-to-video editing. Max 4K. Also supports video clip inputs.

## How Multi-Shot Image-to-Video Works

The input image is an **anchor frame** that locks visual identity (character, environment, lighting) for the entire generation. The `multi_prompt` list defines each shot. The model generates all shots in one pass -- this is why consistency across cuts is better than chaining separate generations.

**Important constraint:** `multi_prompt` is mutually exclusive with `end_image_url`. You cannot use both.

## FAL Endpoints

```
fal-ai/kling-video/v3/standard/image-to-video   (720p)
fal-ai/kling-video/v3/pro/image-to-video        (1080p)
fal-ai/kling-video/v3/standard/text-to-video
fal-ai/kling-video/v3/pro/text-to-video
fal-ai/kling-video/o3/standard/image-to-video   (720p)
fal-ai/kling-video/o3/pro/image-to-video        (4K)
```

## Key API Params

| Param             | Notes                                                                              |
| ----------------- | ---------------------------------------------------------------------------------- |
| `start_image_url` | Anchor frame -- locks visual identity                                              |
| `prompt`          | Single-shot mode. Mutually exclusive with `multi_prompt`                           |
| `multi_prompt`    | Array of `{prompt, duration}` objects -- enables multi-shot                        |
| `shot_type`       | `"customize"` (default, you define each shot) or `"intelligent"` (model auto-cuts) |
| `duration`        | Total video length, 3-15 seconds                                                   |
| `aspect_ratio`    | `16:9`, `9:16`, `1:1`                                                              |
| `generate_audio`  | Native audio synthesis, default `true`                                             |
| `voice_ids`       | Up to 2 voices, referenced in prompts as `<<<voice_1>>>`                           |
| `elements`        | Character/object references -- referenced in prompt as `@Element1`                 |
| `cfg_scale`       | Prompt adherence, default `0.5`. Lower = more creative, higher = more literal      |

## Multi-Shot Payload Example (FAL JS)

```js
const result = await fal.subscribe('fal-ai/kling-video/v3/pro/image-to-video', {
  input: {
    start_image_url: 'https://...', // anchor reference image
    shot_type: 'customize',
    duration: '15',
    aspect_ratio: '16:9',
    generate_audio: true,
    multi_prompt: [
      {
        prompt:
          'Wide establishing shot. Woman stands at end of hallway, camera static, dim corridor, late night.',
        duration: '5',
      },
      {
        prompt:
          'Medium tracking shot moving backward as she walks slowly toward camera, steps hesitant, eyes fixed ahead.',
        duration: '5',
      },
      {
        prompt:
          'Extreme close-up of her face, camera static, breath unsteady, fear in her eyes. Horror riser audio.',
        duration: '5',
      },
    ],
  },
})
```

**Rules:**

- When using `multi_prompt`, leave `prompt` empty
- Each element: `{ prompt: string, duration: "3" | "5" | "7" | "10" | "15" }`
- Total duration = sum of all shot durations (set `duration` to match)
- Max 6 shots per generation

## shot_type Modes

- **`"customize"`** -- you define every shot explicitly via `multi_prompt`. More control, more cognitive overhead. Use when exact framing per shot matters.
- **`"intelligent"`** -- provide one narrative prompt, model auto-decides cuts, framing, and pacing. Less control but lower effort. Cut points are unpredictable.

## Shot Duration Guidance

| Use case                                           | Duration            |
| -------------------------------------------------- | ------------------- |
| Quick action beat, reaction, cutaway               | 3-4s                |
| Standard narrative shot, dialogue line, reveal     | **5s (sweet spot)** |
| Complex camera move, two-step action, establishing | 6-7s                |
| Long dialogue, environment survey, slow reveal     | 8-10s               |
| Full sub-scene with progression                    | 10-15s              |

- Standard 3-shot arc: 5s + 5s + 5s = 15s max
- 4-6 shots in 10-15s total; more than 6 shots in under 10s feels rushed
- Longer durations only pay off if the prompt explicitly describes action progression over time

## Pricing on FAL (pay-per-second)

| Tier        | Resolution | No Audio | Audio On | Voice On |
| ----------- | ---------- | -------- | -------- | -------- |
| V3 Standard | 720p       | $0.168/s | $0.252/s | --       |
| V3 Pro      | 1080p      | $0.224/s | $0.336/s | $0.392/s |
| O3 Standard | 720p       | $0.168/s | $0.224/s | --       |
| O3 Pro      | 4K         | $0.224/s | $0.280/s | --       |

Multi-shot has no extra per-shot charge -- cost is purely duration-based. A 15s V3 Pro no-audio generation costs ~$3.36.

## Kling 3.0 vs 2.5

| Feature               | 2.5      | 3.0                 |
| --------------------- | -------- | ------------------- |
| Multi-shot            | No       | Up to 6 shots       |
| Max duration          | 10s      | 15s                 |
| Max resolution        | 1080p    | 4K (O3)             |
| Native audio          | No       | Yes                 |
| Video-to-video        | No       | O3 only             |
| Character consistency | Drifts   | Strong via elements |
| Voice/lip-sync        | External | Native              |

## Limitations

- Max 6 shots, 15s total
- Color grading can shift between cuts
- `end_image_url` incompatible with multi-shot
- Hands/fingers still produce artifacts (industry-wide)
- Close physical contact between characters can "melt"
- ~30-40% of complex generations may need retries
- Intelligent mode gives unpredictable cut points

## Current Genzen Video Model

Currently using `fal-ai/kling-video/o1/image-to-video` (first/last frame mode) via `generate-flf-video.server.ts`. Upgrading to V3/O3 would unlock multi-shot and native audio.
