Style collections: curated image sets used as reference images during generation.

## Key Files

- `index.ts` -- barrel exports
- `hooks/useStyleCollections.ts` -- CRUD hook for style collections + images (library/create/edit views)
- `components/StyleTrainerPageContent.tsx` -- library grid, create form, edit view with image management
- `server/create-style.server.ts` -- create new style collection
- `server/get-styles.server.ts` -- list styles with thumbnails + get style images with signed URLs
- `server/save-style-image.server.ts` -- copy images into styles bucket from library/upload/URL
- `server/delete-style.server.ts` -- delete collection + storage cleanup
- `server/remove-style-image.server.ts` -- remove single image + update counts/thumbnail
- `server/compose-style-sheet.server.ts` -- tiles images into contact sheet grids (Sharp) when >14 images
- `server/resolve-style-refs.server.ts` -- fetches style images, composes sheets, uploads to FAL storage

## Route

`src/routes/dashboard/dev-workspace.style-trainer.tsx`

## Database

- `style_collections` -- user_id, name, thumbnail_path, image_count
- `style_images` -- style_id (cascade), storage_path, source, sort_order
- Storage bucket: `styles` (private, user-scoped paths)

## Generation Integration

- `generateImage` accepts optional `styleId` -- resolves style refs server-side
- Style picker in GeneratorPanel on AI Images page (paintbrush icon button)
- Contact sheet compositor auto-tiles when collection has >14 images

## Shared Dependencies

- `@/components/ActionButton`, `@/components/ImageSourceButtons`, `@/components/RemoveButton`
- `@/components/LibraryPickerButton` -- SelectedImage type
- `@/lib/auth` -- useAuth for user/session
- `@/features/user-images/hooks/useExistingImages` -- library image picker data
- `@/lib/server/fal-image-upload.server` -- uploadBufferToFal
