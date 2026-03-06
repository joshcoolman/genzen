## Describe Feature Module

Route: `/dashboard/describe` -- tool for describing images and generating variations.

### Architecture

Master hook pattern: `useDescribePage` composes all sub-hooks, passes return value to `DescribePageContent`.

```
types.ts                          # CollectedImage, CreateUserImageInput, Zod schemas
lib/
  file-hash.ts                    # SHA-256 (fresh copy, no cross-feature import)
  filename-parser.ts              # Title from filename (fresh copy)
hooks/
  useDescribePage.ts              # Master hook -- composes all below
  useImageUpload.ts               # Supabase storage upload + DB insert -> CollectedImage
  useExistingImages.ts            # Fetch user's existing images + signed URLs
  useImageDescriber.ts            # Image-to-image pipeline: describe -> generate
components/
  DescribePageContent.tsx         # Page layout (describer card)
  ImageDescriberCard.tsx          # Describer pipeline UI with paste/upload/library source inputs
  ExistingImagePicker.tsx         # Dialog: source filter tabs, checkbox select, confirm
server/
  describe-image.server.ts       # AI image description endpoint
  generate-from-description.server.ts  # Generate image from description
  save-generated-image.server.ts # Save generated image to storage
index.ts                          # Barrel: DescribePageContent, useDescribePage
```

### Key Decisions

- **Self-contained**: No imports from other feature modules. Fresh copies of utilities.
- **Shared components OK**: Uses `@/components/ImageCard`, `ImageGrid`, `ActionButton`, `ImageSourceButtons`, shadcn Dialog
- **Input primitives**: Source image inputs (upload, paste, library) handled via shared `ImageSourceButtons` component.

### Route File Pattern

Thin route at `src/routes/dashboard/describe.tsx`:

```tsx
const page = useDescribePage()
return <DescribePageContent page={page} />
```
