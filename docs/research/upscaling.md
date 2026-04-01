# Image Upscaling Feature Research

Research date: April 2026

## Overview

Image upscaling enhances resolution while preserving or improving detail. In GenZen, upscaling would complement existing generation workflows by enabling users to refine outputs for high-resolution deliverables.

## Use Cases

1. **Post-Generation Enhancement** - User generates at 1024×1024, upscales to 4K for print/video
2. **Export Prep** - Canvas compositions upscaled before final export
3. **Winner Selection** - Multi-model grid → pick best → upscale for production
4. **Quality Recovery** - Upscale user-uploaded reference images before using in workflows
5. **Video Frame Enhancement** - Upscale first/last frames before video generation

## Architecture Options

### Option 1: Minimal Utility Hook (Fastest to Ship)

**Structure:**

```
src/features/ai-images/
  server/upscale-image.server.ts
  hooks/useUpscale.ts
```

**Pattern:** Follows outpaint's server function structure:

1. `requireAuth(accessToken)`
2. `checkAndDeductCredits()` with `withCreditRefund` wrapper
3. Submit to FAL upscale model via `fal.queue.submit`
4. `createPendingGeneration()` for polling
5. Return `{ recordId }` for client-side result handling

**Access Points:**

- Context menu on any image card: "Upscale 2x", "Upscale 4x"
- Action button in image detail view
- Batch upscale in selection mode

**Pros:**

- Reuses existing patterns (credits, polling, results grid)
- No new UI surface area
- Ships in ~2-3 hours

**Cons:**

- No preview/comparison
- Limited control over parameters

### Option 2: Quick Upscale Dialog (Moderate Complexity)

**Structure:**

```
src/features/upscale/
  server/upscale-image.server.ts
  hooks/useQuickUpscale.ts
  components/QuickUpscaleDialog.tsx
  index.ts
```

**Pattern:** Mirrors `QuickOutpaintDialog`:

- Modal with before/after preview (slide to compare)
- Scale factor selector (2x, 4x, 8x)
- Model selector (if multiple upscale models available)
- Submit button with credit cost display

**Integration:**

- Called from context menus, image detail view, canvas export flow
- Reuses `useGenerationResults` for polling

**Pros:**

- Visual feedback before committing credits
- User can compare models/settings
- Better UX for expensive operations

**Cons:**

- More code to maintain
- Requires comparison UI component

### Option 3: Dedicated Upscale Page (Full Feature)

**Structure:**

```
src/features/upscale/
  server/upscale-image.server.ts
  hooks/useUpscalePage.ts
  components/UpscalePageContent.tsx
  components/UpscaleCard.tsx
  components/UpscalePreview.tsx
  CLAUDE.md
```

**Route:** `/dashboard/dev-workspace.upscale`

**Features:**

- Side-by-side comparison with zoom/pan
- Multiple models with A/B testing
- Batch processing queue
- Download original + upscaled + comparison grid

**Pros:**

- Power-user friendly
- Can justify higher credit costs with rich UX
- Natural home for upscale-specific settings

**Cons:**

- Largest scope (~1-2 days)
- May be overkill for simple upscaling

## FAL Model Options

**Models to research** (need FAL catalog search):

- `fal-ai/clarity-upscaler` (likely general-purpose)
- `fal-ai/supir/v1` (SUPIR - quality-focused, slower)
- `fal-ai/real-esrgan` (Real-ESRGAN - fast, classic)
- `fal-ai/aura-sr` (Aura-SR - recent SOTA)
- `fal-ai/ccsr` (CCSR - controllable)

**Model registry addition** (once models confirmed):

```typescript
// src/features/ai-images/models.ts
export interface UpscaleModel {
  id: string
  name: string
  description: string
  maxScale: 2 | 4 | 8
  speedTier: 'fast' | 'balanced' | 'quality'
}

export const UPSCALE_MODELS: Array<UpscaleModel> = [
  {
    id: 'fal-ai/clarity-upscaler',
    name: 'Clarity Upscaler',
    description: 'Balanced speed and quality',
    maxScale: 4,
    speedTier: 'balanced',
  },
  // ... add after fal-models skill search
]

export const DEFAULT_UPSCALE_MODEL = UPSCALE_MODELS[0].id
```

## Credit Cost Structure

### Flat Rate (Simplest)

- All upscales = `CREDIT_COSTS.image_gen` (1 credit)
- Easy to reason about, matches generation cost

### Tiered by Scale Factor

```typescript
// src/features/credits/constants.ts
export const UPSCALE_COSTS = {
  '2x': 1,
  '4x': 2,
  '8x': 4,
} as const
```

- Fairer for small upscales
- Requires UI to show cost before submission

### Tiered by Model Speed

```typescript
// src/features/credits/constants.ts
export const UPSCALE_COSTS = {
  fast: 1,
  balanced: 2,
  quality: 3,
} as const
```

- Aligns with FAL's pricing model
- Encourages fast previews before quality upscales

**Recommendation:** Start with flat rate, add tiering if users request it.

## Integration Points

### 1. Generation Results Grid

After generating in multi-model/scenes/canvas:

```tsx
<ContextMenu>
  <ContextMenuItem onClick={() => upscale(result, '2x')}>
    Upscale 2x (1 credit)
  </ContextMenuItem>
</ContextMenu>
```

### 2. Canvas Export Flow

Before exporting composition:

```tsx
<Button onClick={handleExport}>Export {upscaleEnabled && '(Upscaled)'}</Button>
```

### 3. Image Detail View

Full-screen image viewer with action bar:

```tsx
<ActionBar>
  <Button onClick={() => openUpscaleDialog()}>Upscale</Button>
</ActionBar>
```

### 4. Video First/Last Frame Workflow

In `ai-video` feature, upscale frames before submission:

```typescript
// Optional pre-processing step
if (userWantsUpscaledFrames) {
  const upscaledFirst = await upscaleImage({
    sourceImageUrl: firstFrame.url,
    scaleFactor: '2x',
  })
  // Use upscaled URL in video generation
}
```

## Server Function Structure

Based on `outpaint-image.server.ts` pattern:

```typescript
// src/features/upscale/server/upscale-image.server.ts
import { createServerFn } from '@tanstack/react-start'
import { fal } from '@fal-ai/client'
import { requireAuth } from '@/lib/server/auth.server'
import {
  checkAndDeductCredits,
  withCreditRefund,
} from '@/features/credits/server/check-credits.server'
import { createPendingGeneration } from '@/lib/server/create-pending-generation.server'
import { DEFAULT_UPSCALE_MODEL } from '@/features/ai-images/models'

interface UpscaleImageInput {
  accessToken: string
  sourceImageUrl: string
  scaleFactor: '2x' | '4x' | '8x'
  model?: string
}

export const upscaleImage = createServerFn({ method: 'POST' })
  .inputValidator((data: UpscaleImageInput) => data)
  .handler(async ({ data }) => {
    const user = await requireAuth(data.accessToken)

    // Credit check with tiered cost (if implemented)
    const creditType = 'image_gen' // or 'upscale' if separate
    const creditResult = await checkAndDeductCredits(
      data.accessToken,
      creditType,
    )

    if (!creditResult.allowed) {
      throw new Error('Insufficient credits')
    }

    return withCreditRefund(
      creditResult.userId,
      creditResult.cost,
      creditType,
      async () => {
        const modelId = data.model ?? DEFAULT_UPSCALE_MODEL

        // Upload source to FAL storage
        const imageRes = await fetch(data.sourceImageUrl)
        const buffer = Buffer.from(await imageRes.arrayBuffer())
        const falImageUrl = await fal.storage.upload(buffer)

        // Submit to upscale model
        const { request_id } = await fal.queue.submit(modelId, {
          input: {
            image: falImageUrl,
            scale: parseInt(data.scaleFactor), // 2, 4, or 8
            // Other model-specific params
          },
          webhookUrl: getFalWebhookUrl(), // if using webhooks
        })

        // Create pending generation record
        const { recordId } = await createPendingGeneration({
          accessToken: data.accessToken,
          userId: user.id,
          requestId: request_id,
          generationType: 'upscale',
          falModelId: modelId,
          metadata: {
            source_image_id: extractImageId(data.sourceImageUrl),
            scale_factor: data.scaleFactor,
          },
        })

        return { recordId }
      },
    )
  })
```

## Client Hook Structure

```typescript
// src/features/upscale/hooks/useUpscale.ts
import { useMutation } from '@tanstack/react-query'
import { upscaleImage } from '../server/upscale-image.server'
import { useAuth } from '@/lib/hooks/useAuth'
import { useToast } from '@/components/ui/use-toast'

export function useUpscale() {
  const { session } = useAuth()
  const { toast } = useToast()

  const { mutateAsync, isPending } = useMutation({
    mutationFn: (opts: {
      sourceImageUrl: string
      scaleFactor: '2x' | '4x' | '8x'
      model?: string
    }) => {
      if (!session?.access_token) throw new Error('Not authenticated')
      return upscaleImage({
        accessToken: session.access_token,
        ...opts,
      })
    },
    onSuccess: (result) => {
      toast({
        title: 'Upscaling started',
        description: 'Your image is being upscaled. Check results grid.',
      })
      // Polling handled by useGenerationResults
    },
    onError: (error) => {
      toast({
        title: 'Upscale failed',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  return {
    upscale: mutateAsync,
    isUpscaling: isPending,
  }
}
```

## Database Schema Extensions

Add upscale metadata to existing `media` table:

```sql
-- In pending_generations.metadata JSONB:
{
  "generation_type": "upscale",
  "source_image_id": "uuid-of-original",
  "scale_factor": "2x",
  "model_id": "fal-ai/clarity-upscaler"
}

-- Consider adding upscale relationship:
ALTER TABLE media
ADD COLUMN upscaled_from_id UUID REFERENCES media(id);

-- Query original and all upscales:
SELECT * FROM media
WHERE id = 'original-id'
   OR upscaled_from_id = 'original-id';
```

## UI/UX Considerations

### Before/After Comparison Component

```tsx
// src/features/upscale/components/UpscaleComparison.tsx
export function UpscaleComparison({
  originalUrl,
  upscaledUrl,
}: {
  originalUrl: string
  upscaledUrl: string
}) {
  const [sliderPosition, setSliderPosition] = useState(50)

  return (
    <div className="relative">
      <img src={originalUrl} alt="Original" />
      <div
        style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
        className="absolute inset-0"
      >
        <img src={upscaledUrl} alt="Upscaled" />
      </div>
      <input
        type="range"
        min="0"
        max="100"
        value={sliderPosition}
        onChange={(e) => setSliderPosition(Number(e.target.value))}
      />
    </div>
  )
}
```

### Context Menu Integration

```tsx
// In src/components/ImageCard.tsx
<ContextMenuContent>
  {/* Existing actions */}
  <ContextMenuSeparator />
  <ContextMenuSub>
    <ContextMenuSubTrigger>Upscale</ContextMenuSubTrigger>
    <ContextMenuSubContent>
      <ContextMenuItem onClick={() => handleUpscale('2x')}>
        2x (1 credit)
      </ContextMenuItem>
      <ContextMenuItem onClick={() => handleUpscale('4x')}>
        4x (2 credits)
      </ContextMenuItem>
    </ContextMenuSubContent>
  </ContextMenuSub>
</ContextMenuContent>
```

## Testing Checklist

- [ ] Upscale from generation results grid
- [ ] Upscale from user-uploaded images
- [ ] Credit deduction works correctly
- [ ] Credit refund on FAL failure
- [ ] Pending generation polling
- [ ] Result appears in results grid
- [ ] Download upscaled image
- [ ] Metadata preserved (prompt, model, etc.)
- [ ] Upscale chain tracking (original → 2x → 4x)
- [ ] Concurrent upscale requests don't race

## Open Questions

1. **Should upscales count toward user's image library quota?**
   - Yes: Consistent with all generated images
   - No: Upscales are derivatives, not new creations

2. **Max upscale size limit?**
   - Prevent 8K+ upscales that blow out storage/bandwidth
   - Cap at 4096×4096? 8192×8192?

3. **Batch upscaling?**
   - Select multiple images → upscale all
   - Could be expensive (N images × cost)
   - Requires queue management UI

4. **Upscale + edit in one step?**
   - Combine with edit-image workflow
   - "Upscale and refine with prompt"
   - More complex but powerful

## Next Steps

1. **Search FAL catalog** for available upscale models using `fal-models` skill
2. **Add models to registry** (`models.ts` with exact endpoint IDs)
3. **Implement minimal utility hook** (Option 1) for quick validation
4. **Test credit flow** and polling integration
5. **Add context menu integration** to existing image cards
6. **Gather user feedback** before expanding to full feature page

## Related Features

- **Outpaint** - Similar server pattern, credit handling, polling
- **Edit** - Could combine upscale + edit in single workflow
- **Canvas Export** - Natural integration point for high-res output
- **Multi-Model** - Upscale winner from comparison grid
- **AI Video** - Upscale first/last frames before video generation

## References

- Outpaint implementation: `src/features/outpaint/server/outpaint-image.server.ts`
- Credit system: `src/features/credits/CLAUDE.md`
- Generation polling: `src/lib/hooks/useGenerationResults.ts`
- FAL queue API: https://docs.fal.ai/model-apis/model-endpoints/queue
