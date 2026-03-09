Browsable catalog of FAL AI models with category filtering, search, pagination, and a "recently added" carousel.

## Key Files

- `index.ts` -- barrel exports (ModelsPage, useModels, types)
- `types.ts` -- FalModel, FalModelPricing, ModelCategory, and API response shapes
- `server/fetch-models.server.ts` -- TanStack server fn hitting `api.fal.ai/v1/models` with cursor pagination
- `server/fetch-pricing.server.ts` -- TanStack server fn for per-model pricing lookup
- `hooks/use-models.ts` -- client hook with module-level cache, debounced search, and paginated loading
- `components/ModelsPage.tsx` -- main page layout with search bar, category tabs, model grid, and load-more
- `components/ModelCard.tsx` -- individual model display with endpoint copy, external link, and muted color palette
- `components/CategoryTabs.tsx` -- filter tabs (All, Text to Image, Image to Video, Text to Video)
- `components/RecentlyAddedCarousel.tsx` -- sorts models by date, shows 4 (expandable to 12)

## Route

`src/routes/dashboard/models.tsx`

## Shared Dependencies

- `@tanstack/react-start` -- createServerFn for server functions
- `@/components/ui/skeleton`, `button`, `input`, `separator` -- shadcn primitives
- `FAL_KEY` env var -- required for API auth (server-side only)

## Quirks / Notes

- Module-level cache in `use-models.ts` survives component unmount/remount -- cache key is `category:search`
- Search is debounced at 300ms
- Models are deduplicated by `endpoint_id` across pages
- ModelCard has 12 hardcoded muted color schemes used via `colorIndex` prop (only used by RecentlyAddedCarousel)
- `fetchPricing` server fn exists but is not currently consumed by any component
