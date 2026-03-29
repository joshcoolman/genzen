## Overview

A searchable, filterable catalog of all available FAL AI models. Includes a "recently added" carousel, category tabs, and per-model details with endpoint copy.

## How It Works

1. Models fetched from FAL API with cursor-based pagination
2. Module-level cache survives unmount/remount (key: `category:search`)
3. Search debounced at 300ms, models deduplicated by `endpoint_id`

## Usage

- Navigate to Dev Workspace > Models
- Search or filter by category
- Click endpoint to copy, external link to view on FAL

## Key Files

- `src/features/models/server/fetch-models.server.ts` -- Server fn hitting `api.fal.ai/v1/models` with cursor pagination (48/page)
- `src/features/models/server/fetch-pricing.server.ts` -- Per-model pricing lookup (not currently consumed)
- `src/features/models/hooks/use-models.ts` -- Client hook with module-level cache, 300ms debounced search
- `src/features/models/components/ModelsPage.tsx` -- Search bar, category tabs, model grid, load-more
- `src/features/models/components/ModelCard.tsx` -- Individual model with endpoint copy, external link, 12 color schemes
- `src/features/models/components/CategoryTabs.tsx` -- Filter: All, Text to Image, Image to Video, Text to Video
- `src/features/models/components/RecentlyAddedCarousel.tsx` -- Sorts by date, shows 4 (expandable to 12)

## Dependencies

- FAL API (`api.fal.ai/v1/models`)
- `FAL_KEY` env var (server-side)

## Route

`/dashboard/dev-workspace/models`
