Upload a source image, generate shot variations at a target aspect ratio, select favorites, and upscale (currently mock/UI-only).

## Key Files

- `index.ts` -- barrel exports
- `hooks/useShotsPage.ts` -- state machine for 3-step flow (upload, select, upscale); includes aspect ratio mismatch detection
- `components/ShotsPageContent.tsx` -- step UIs with aspect-ratio preview, shot selection grid, and upscale results

## Route

`src/routes/dashboard/shots.tsx`

## Shared Dependencies

- `@/components/ActionButton` -- primary action buttons
- `@/components/ImageSourceButtons` -- upload + library picker combo
- `@/components/AspectRatioSelect` -- orientation + ratio picker
- `@/components/LibraryPickerButton` -- SelectedImage type
- `@/lib/auth` -- useAuth for user context
- `@/features/describe/hooks/useExistingImages` -- fetches user's existing image library

## Quirks / Notes

- `needsOutpaint` computed by comparing source image natural dimensions to target aspect ratio (5% tolerance); shows "Outpaint to fill" button when mismatched
- Shot generation is mocked -- produces 9 gradient placeholders
- Upscale step just labels selected shots as "Upscaled" with no actual processing
