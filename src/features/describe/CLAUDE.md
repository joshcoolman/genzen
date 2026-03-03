## Describe Feature Module

Route: `/dashboard/describe` -- tool for collecting images and generating descriptions.

### Status: Phase 1 Complete (Image Collection)

Upload, paste, and select-from-library all working. Images persist to Supabase (`user-images` bucket + `user_images` table). Collection persisted to localStorage with 1-hour TTL.

### Phase 2 (Not Started)

Send collected images to AI for description generation. Will need server functions and a results display.

### Architecture

Master hook pattern: `useDescribePage` composes all sub-hooks, passes return value to `DescribePageContent`.

```
types.ts                          # CollectedImage, CreateUserImageInput, Zod schemas
lib/
  file-hash.ts                    # SHA-256 (fresh copy, no cross-feature import)
  filename-parser.ts              # Title from filename (fresh copy)
  process-files.ts                # Validate + upload pipeline
hooks/
  useDescribePage.ts              # Master hook -- composes all below
  useImageCollection.ts           # Client state: add/addMany/remove/retainOnly/clear + localStorage
  useImageUpload.ts               # Supabase storage upload + DB insert -> CollectedImage
  useExistingImages.ts            # Fetch user's existing images + signed URLs
  useImageDescriber.ts            # Image-to-image pipeline: describe -> generate
components/
  DescribePageContent.tsx         # Page layout (toolbar + grid + picker + describer)
  CollectionToolbar.tsx           # FileUploadButton + ClipboardPasteButton + Library button
  ImageDescriberCard.tsx          # Describer pipeline UI with paste/upload/library source inputs
  ImageCollectionGrid.tsx         # Grid of collected images with remove overlay
  ExistingImagePicker.tsx         # Dialog: source filter tabs, checkbox select, confirm
index.ts                          # Barrel: DescribePageContent, useDescribePage
```

### Key Decisions

- **Self-contained**: No imports from other feature modules. Fresh copies of utilities.
- **Shared components OK**: Uses `@/components/ImageCard`, `ImageGrid`, `ActionButton`, `FileUploadButton`, `ClipboardPasteButton`, shadcn Dialog
- **Input primitives**: `FileUploadButton` and `ClipboardPasteButton` are shared components at `@/components/`. Both used in CollectionToolbar (collection uploads to Supabase) and ImageDescriberCard (sends data URL directly to server, no Supabase upload).
- **Collection = references**: Just IDs pointing to `user_images` rows, no separate table
- **localStorage persistence**: Collection saved to `describe-collection` key with 1-hour TTL. Validated against Supabase on mount to prune stale references.
- **Newest first**: New images prepend to collection (most recent at top)
- **addedInSession flag**: `CollectedImage.addedInSession` tracks origin. `true` = pasted/uploaded in Describe, `false` = selected from library picker.
- **Destructive remove**: Removing a session-added image deletes from Supabase storage + DB. Removing a library-selected image only drops the collection reference.
- **Picker dialog**: 66vw width (inline style to beat shadcn specificity), scrollable grid with fixed footer
- **Already-collected items**: Shown in separate section above available images

### Route File Pattern

Thin route at `src/routes/dashboard/describe.tsx`:

```tsx
const page = useDescribePage()
return <DescribePageContent page={page} />
```
