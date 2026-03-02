# FAL Workflows API Research

Research date: March 2026

## What Are FAL Workflows?

Chain multiple FAL models into a single pipeline exposed as one API endpoint. Define the pipeline as a JSON graph - FAL executes it as a unit with streaming events.

## Two Approaches

### 1. Inline Workflows (No Pre-Registration)

POST to `workflows/execute` with the full JSON graph. Most flexible for dynamic pipelines.

```http
POST https://fal.run/workflows/execute
Authorization: Key YOUR_FAL_KEY
Content-Type: application/json

{
  "input": { "prompt": "..." },
  "workflow": { /* JSON graph */ }
}
```

### 2. Named/Pre-built Workflows

Callable like any model: `workflows/fal-ai/sdxl-sticker`

## Workflow JSON Structure

Three node types: `input`, `run` (calls a FAL model), `display` (output).

Outputs wire between nodes via `$nodeId.field.nested.path` syntax:

```json
{
  "input": { "id": "input", "type": "input", "depends": [], "input": { "prompt": "" } },
  "gen_image": {
    "id": "gen_image", "type": "run", "depends": ["input"],
    "app": "fal-ai/flux/dev",
    "input": { "prompt": "$input.prompt" }
  },
  "output": {
    "id": "output", "type": "display", "depends": ["gen_image"],
    "fields": { "image_url": "$gen_image.images.0.url" }
  }
}
```

## Streaming Events

As each step completes, events fire:
- `submit` - step was submitted (includes `app_id`, `request_id`, `node_id`)
- `completion` - step finished, includes intermediate output
- `output` - full workflow done
- `error` - failure with HTTP status

## SDK Usage

```typescript
import { fal } from "@fal-ai/client";

const stream = await fal.stream("workflows/execute", {
  input: { prompt: "..." },
  workflow: { /* graph */ }
});

for await (const event of stream) {
  console.log(event); // fires on each step
}

const result = await stream.done();
```

## Discover Model Input/Output Schemas

```
https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=fal-ai/flux/dev
```

## First-Frame + Last-Frame + Video Pipeline

Two implementation options:

### Option A: Sequential FAL calls in Trigger.dev (simpler)
1. `fal.subscribe("fal-ai/flux/dev")` -> first frame
2. `fal.subscribe("fal-ai/flux/dev")` -> last frame
3. `fal.subscribe("fal-ai/wan-flf2v")` with both URLs -> video

Easier to debug, clear error handling per step.

### Option B: Inline FAL Workflow (fewer round-trips)
4-node graph: `input -> gen_first -> gen_last -> gen_video -> output`
Leverage streaming for real-time progress.

## Relevant Video Models for Workflows

| Model | Endpoint | Use |
|---|---|---|
| Wan 2.1 FLF2V | `fal-ai/wan-flf2v` | First + last frame to video |
| Veo 3.1 FLF | `fal-ai/veo3.1/first-last-frame-to-video` | Google's version |
| Seedance 1.0 Pro I2V | `fal-ai/bytedance/seedance/v1/pro/image-to-video` | Supports `end_image_url` |
| Kling O1 I2V | `fal-ai/kling-video/o1/image-to-video` | Kling's approach |

## Docs

- [Workflow endpoints API](https://docs.fal.ai/model-apis/model-endpoints/workflows)
- [Custom Workflow UI Tutorial](https://docs.fal.ai/model-apis/guides/custom-workflow-ui)
- [Key-Based Auth](https://docs.fal.ai/model-apis/authentication/key-based)
